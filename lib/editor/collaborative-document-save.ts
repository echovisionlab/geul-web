'use client';

import type { HocuspocusProvider } from '@hocuspocus/provider';
import type { Transaction } from 'yjs';
import { persistCollaborativeDocumentNow } from '@/lib/collab/persist-now';
import {
  blockRoomDurabilityStateCovers,
  captureBlockRoomDurabilityState,
  mergeBlockRoomDurabilityStates,
  waitForBlockRoomDurabilityAcknowledgement,
  type BlockRoomDurabilityProtocol,
  type BlockRoomDurabilityState,
} from '@/lib/collab/block-room-durability';
import { notifyEditorSaveStateChanged, registerEditorSave } from './editor-save-registry';

const MAX_FLUSH_ROUNDS = 4;
const AUTOMATIC_PERSIST_DEBOUNCE_MS = 2_000;

interface ActiveFlush {
  operation: Promise<boolean>;
  hadError: boolean;
}

const replayOrigins = new WeakSet<object>();

/** A semantic replay is local author intent, even though Y.applyUpdate marks it remote. */
export function createCollaborativeDocumentReplayOrigin(): object {
  const origin = {};
  replayOrigins.add(origin);
  return origin;
}

export function isCollaborativeDocumentReplayOrigin(origin: unknown): boolean {
  return typeof origin === 'object' && origin !== null && replayOrigins.has(origin);
}

export type CollaborativeDocumentSavePersistence =
  { kind: 'block-room'; protocol: BlockRoomDurabilityProtocol } | { kind: 'persist-now' };

export interface CollaborativeDocumentSaveTracker {
  flush: (onError?: (error: unknown) => void) => Promise<boolean>;
  hasPending: () => boolean;
  register: (documentKey: string, onFlushError?: (error: unknown) => void) => () => void;
}

/** Shares one local-intent and durability tracker between an editor and its save registry. */
export function createCollaborativeDocumentSaveTracker(
  provider: HocuspocusProvider,
  persistence: CollaborativeDocumentSavePersistence = { kind: 'persist-now' },
): CollaborativeDocumentSaveTracker {
  const document = provider.document;
  let localRevision = 0;
  let durableRevision = 0;
  let pendingDurabilityState: BlockRoomDurabilityState | null = null;
  let activeFlush: ActiveFlush | null = null;
  let documentKey: string | null = null;

  const handleAfterTransaction = (transaction: Transaction) => {
    // Remote updates, including canonical revision metadata, are not local authoring.
    if (
      (!transaction.local && !isCollaborativeDocumentReplayOrigin(transaction.origin)) ||
      transaction.origin === provider ||
      transaction.changed.size === 0
    ) {
      return;
    }

    localRevision += 1;
    if (persistence.kind === 'block-room') {
      pendingDurabilityState = mergeBlockRoomDurabilityStates(
        pendingDurabilityState,
        captureBlockRoomDurabilityState(document, transaction),
      );
    }
    if (documentKey) {
      notifyEditorSaveStateChanged(documentKey);
    }
  };

  const hasPending = () =>
    persistence.kind === 'block-room' ? pendingDurabilityState !== null : localRevision > durableRevision;

  const flush = (onError?: (error: unknown) => void, continueFlushing?: () => boolean): Promise<boolean> => {
    if (activeFlush) {
      return activeFlush.operation;
    }

    const state: ActiveFlush = { operation: Promise.resolve(false), hadError: false };
    const operation = (async () => {
      for (let round = 0; round < MAX_FLUSH_ROUNDS; round += 1) {
        if (continueFlushing && !continueFlushing()) {
          return false;
        }
        if (!hasPending()) {
          return true;
        }

        const revisionBeingFlushed = localRevision;
        const expectedDurability = pendingDurabilityState;
        const acknowledgementAbort = new AbortController();
        const acknowledgement =
          persistence.kind === 'block-room' && expectedDurability
            ? waitForBlockRoomDurabilityAcknowledgement(persistence.protocol, expectedDurability, {
                signal: acknowledgementAbort.signal,
              })
            : null;

        try {
          // This asks the resident to persist. Only block_room.persisted proves block-room durability.
          await persistCollaborativeDocumentNow(provider);
        } catch (error) {
          state.hadError = true;
          acknowledgementAbort.abort();
          if (!hasPending()) {
            return true;
          }
          onError?.(error);
          return false;
        }

        if (persistence.kind === 'persist-now') {
          durableRevision = Math.max(durableRevision, revisionBeingFlushed);
          continue;
        }

        if (!hasPending()) {
          acknowledgementAbort.abort();
          return true;
        }

        // A persist.now response may precede the broadcast. Keep waiting for the exact durable stamp.
        const acknowledgedState = acknowledgement ? await acknowledgement : null;
        if (!acknowledgedState) {
          state.hadError = true;
          onError?.(new Error('Block room durability acknowledgement timed out.'));
          return false;
        }
        if (pendingDurabilityState && blockRoomDurabilityStateCovers(acknowledgedState, pendingDurabilityState)) {
          pendingDurabilityState = null;
          if (documentKey) {
            notifyEditorSaveStateChanged(documentKey);
          }
        }
      }

      return !hasPending();
    })();

    state.operation = operation;
    activeFlush = state;
    void operation.finally(() => {
      if (activeFlush === state) {
        activeFlush = null;
        if (documentKey) {
          notifyEditorSaveStateChanged(documentKey);
        }
      }
    });
    if (documentKey) {
      notifyEditorSaveStateChanged(documentKey);
    }
    return operation;
  };

  return {
    flush,
    hasPending,
    register: (key, onFlushError) => {
      if (documentKey !== null) {
        throw new Error('A collaborative save tracker can only be registered once.');
      }
      documentKey = key;
      let registered = true;
      let automaticFlushTimer: ReturnType<typeof setTimeout> | null = null;
      let autoFlushRequestedWhileActive = false;
      let observedActiveFlush: ActiveFlush | null = null;
      const isAutomaticFlushEligible = () =>
        registered &&
        persistence.kind === 'persist-now' &&
        hasPending() &&
        provider.isSynced &&
        !provider.hasUnsyncedChanges;
      const observeActiveFlush = (state: ActiveFlush) => {
        if (observedActiveFlush === state) {
          return;
        }
        observedActiveFlush = state;
        const finish = () => {
          if (observedActiveFlush === state) {
            observedActiveFlush = null;
          }
          const shouldFollowUp = registered && !state.hadError && autoFlushRequestedWhileActive && hasPending();
          autoFlushRequestedWhileActive = false;
          if (shouldFollowUp) {
            scheduleAutomaticFlush();
          }
        };
        void state.operation.then(finish, finish);
      };
      const scheduleAutomaticFlush = () => {
        if (!isAutomaticFlushEligible()) {
          return;
        }
        if (activeFlush) {
          autoFlushRequestedWhileActive = true;
          observeActiveFlush(activeFlush);
          return;
        }

        if (automaticFlushTimer !== null) {
          clearTimeout(automaticFlushTimer);
        }
        automaticFlushTimer = setTimeout(() => {
          automaticFlushTimer = null;
          if (!isAutomaticFlushEligible()) {
            return;
          }
          const operation = flush(onFlushError, () => registered);
          if (activeFlush?.operation === operation) {
            observeActiveFlush(activeFlush);
          }
        }, AUTOMATIC_PERSIST_DEBOUNCE_MS);
      };
      const handleUnsyncedChanges = ({ number }: { number: number }) => {
        if (number === 0) {
          scheduleAutomaticFlush();
        }
      };
      const handleSynced = ({ state }: { state: boolean }) => {
        if (state) {
          scheduleAutomaticFlush();
        }
      };

      document.on('afterTransaction', handleAfterTransaction);
      if (persistence.kind === 'persist-now') {
        provider.on('unsyncedChanges', handleUnsyncedChanges);
        provider.on('synced', handleSynced);
      }
      const unsubscribePersisted =
        persistence.kind === 'block-room'
          ? persistence.protocol.subscribePersisted((acknowledgement) => {
              if (pendingDurabilityState && blockRoomDurabilityStateCovers(acknowledgement, pendingDurabilityState)) {
                pendingDurabilityState = null;
                notifyEditorSaveStateChanged(key);
              }
            })
          : () => undefined;
      const unregisterSave = registerEditorSave(key, { flush: () => flush(onFlushError), hasPending });
      scheduleAutomaticFlush();

      return () => {
        registered = false;
        autoFlushRequestedWhileActive = false;
        observedActiveFlush = null;
        if (automaticFlushTimer !== null) {
          clearTimeout(automaticFlushTimer);
          automaticFlushTimer = null;
        }
        if (persistence.kind === 'persist-now') {
          provider.off('unsyncedChanges', handleUnsyncedChanges);
          provider.off('synced', handleSynced);
        }
        document.off('afterTransaction', handleAfterTransaction);
        unsubscribePersisted();
        unregisterSave();
        documentKey = null;
      };
    },
  };
}

/** Registers local document edits as a save that navigation and unload barriers can drain. */
export function registerCollaborativeDocumentSave(
  provider: HocuspocusProvider,
  documentKey: string,
  persistence: CollaborativeDocumentSavePersistence = { kind: 'persist-now' },
): () => void {
  return createCollaborativeDocumentSaveTracker(provider, persistence).register(documentKey);
}
