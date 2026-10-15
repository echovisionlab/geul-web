'use client';

import { parseServerMessage } from '@echovisionlab/geul-common/collaboration/protocol';
import { getProviderAccessEnded } from '@/lib/collab/provider-control-state';
import { createLogger } from '@/lib/utils/logger';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { isLocalAuthorTransaction } from '@/lib/collab/local-author-origin';
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
const AUTOMATIC_PERSIST_RETRY_INITIAL_MS = 1_000;
const AUTOMATIC_PERSIST_RETRY_MAX_MS = 30_000;
/**
 * Block rooms persist on the server's own debounce and broadcast
 * `room.persisted`. When no ACK covers a local edit within this window,
 * the client asks the resident to persist and treats a miss as a failure.
 */
export const BLOCK_ROOM_ACK_WATCHDOG_MS = 10_000;

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

export type CollaborativeDocumentSavePersistence = (
  { kind: 'block-room'; protocol: BlockRoomDurabilityProtocol } | { kind: 'persist-now' }
) & {
  /** Whether unsaved edits are on this device (the room's intent journal settled). Absent: memory only. */
  isDurable?: () => boolean;
  /** The room became read-only: unsaved edits wait for edit access instead of being pending. */
  isParked?: () => boolean;
};

export interface CollaborativeDocumentSaveTracker {
  flush: (onError?: (error: unknown) => void) => Promise<boolean>;
  hasPending: () => boolean;
  /** True after a flush failed while edits are still pending, until a flush or ACK succeeds. */
  hasFailure: () => boolean;
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
  let observeRegisteredFlush: ((state: ActiveFlush) => void) | null = null;
  let onLocalEdit: (() => void) | null = null;
  let onDurable: (() => void) | null = null;
  let failure = false;

  const setFailure = (next: boolean) => {
    if (failure === next) {
      return;
    }
    failure = next;
    if (documentKey) {
      notifyEditorSaveStateChanged(documentKey);
    }
  };

  const markDurable = () => {
    pendingDurabilityState = null;
    durableRevision = localRevision;
    setFailure(false);
    onDurable?.();
    if (documentKey) {
      notifyEditorSaveStateChanged(documentKey);
    }
  };

  const handleAfterTransaction = (transaction: Transaction) => {
    // Remote updates, including canonical revision metadata, are not local authoring.
    if (
      (!isLocalAuthorTransaction(transaction) && !isCollaborativeDocumentReplayOrigin(transaction.origin)) ||
      transaction.origin === provider ||
      transaction.changed.size === 0
    ) {
      return;
    }

    localRevision += 1;
    pendingDurabilityState = mergeBlockRoomDurabilityStates(
      pendingDurabilityState,
      captureBlockRoomDurabilityState(document, transaction),
    );
    if (documentKey) {
      notifyEditorSaveStateChanged(documentKey);
    }
    onLocalEdit?.();
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
        if (getProviderAccessEnded(provider)) {
          return !hasPending();
        }
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
          // This asks the resident to persist. Only room.persisted proves block-room durability.
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

        // A room.flush_result may precede the broadcast. Keep waiting for the exact durable stamp.
        const acknowledgedState = acknowledgement ? await acknowledgement : null;
        if (!acknowledgedState) {
          state.hadError = true;
          onError?.(new Error('Block room durability acknowledgement timed out.'));
          return false;
        }
        if (pendingDurabilityState && blockRoomDurabilityStateCovers(acknowledgedState, pendingDurabilityState)) {
          markDurable();
        }
      }

      return !hasPending();
    })();

    state.operation = operation;
    activeFlush = state;
    void operation.then((saved) => {
      if (saved) {
        setFailure(false);
      } else if (state.hadError && hasPending()) {
        setFailure(true);
      }
    });
    void operation.finally(() => {
      if (activeFlush === state) {
        activeFlush = null;
        if (documentKey) {
          notifyEditorSaveStateChanged(documentKey);
        }
      }
    });
    observeRegisteredFlush?.(state);
    if (documentKey) {
      notifyEditorSaveStateChanged(documentKey);
    }
    return operation;
  };

  const hasFailure = () => failure && hasPending();

  return {
    flush,
    hasPending,
    hasFailure,
    register: (key, onFlushError) => {
      if (documentKey !== null) {
        throw new Error('A collaborative save tracker can only be registered once.');
      }
      documentKey = key;
      let registered = true;
      let automaticFlushTimer: ReturnType<typeof setTimeout> | null = null;
      let automaticFlushTimerIsRetry = false;
      let autoFlushRequestedWhileActive = false;
      let observedActiveFlush: ActiveFlush | null = null;
      let automaticRetryAttempt = 0;
      let automaticRetryPending = false;
      const isBlockRoom = persistence.kind === 'block-room';
      const isAutomaticFlushEligible = () =>
        registered &&
        !getProviderAccessEnded(provider) &&
        hasPending() &&
        provider.isSynced &&
        (isBlockRoom || !provider.hasUnsyncedChanges);
      const retryDelay = () =>
        Math.min(
          AUTOMATIC_PERSIST_RETRY_INITIAL_MS * 2 ** Math.min(Math.max(automaticRetryAttempt - 1, 0), 30),
          AUTOMATIC_PERSIST_RETRY_MAX_MS,
        );
      const observeActiveFlush = (state: ActiveFlush) => {
        if (observedActiveFlush === state) {
          return;
        }
        observedActiveFlush = state;
        const finish = () => {
          if (observedActiveFlush === state) {
            observedActiveFlush = null;
          }
          const shouldRetry = registered && state.hadError && hasPending();
          const shouldFollowUp = registered && !state.hadError && autoFlushRequestedWhileActive && hasPending();
          autoFlushRequestedWhileActive = false;
          if (shouldRetry) {
            automaticRetryPending = true;
            automaticRetryAttempt += 1;
            scheduleAutomaticFlush(retryDelay());
          } else if (shouldFollowUp) {
            automaticRetryAttempt = 0;
            automaticRetryPending = false;
            scheduleAutomaticFlush();
          } else if (!state.hadError) {
            automaticRetryAttempt = 0;
            automaticRetryPending = false;
          }
        };
        void state.operation.then(finish, finish);
      };
      const scheduleAutomaticFlush = (
        delay = automaticRetryPending
          ? retryDelay()
          : isBlockRoom
            ? BLOCK_ROOM_ACK_WATCHDOG_MS
            : AUTOMATIC_PERSIST_DEBOUNCE_MS,
      ) => {
        if (!isAutomaticFlushEligible()) {
          return;
        }
        if (automaticRetryPending && automaticFlushTimerIsRetry && automaticFlushTimer !== null) {
          return;
        }
        // A block-room watchdog measures the oldest unacknowledged edit, so
        // later edits do not postpone it.
        if (isBlockRoom && !automaticRetryPending && automaticFlushTimer !== null) {
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
        const isRetry = automaticRetryPending;
        automaticFlushTimerIsRetry = isRetry;
        automaticFlushTimer = setTimeout(() => {
          automaticFlushTimer = null;
          automaticFlushTimerIsRetry = false;
          if (!isAutomaticFlushEligible()) {
            return;
          }
          if (isRetry) {
            automaticRetryPending = false;
          }
          // Automatic block-room attempts surface through hasFailure(); only
          // explicit flushes (navigation, structure changes) report errors.
          flush(isBlockRoom ? undefined : onFlushError, () => registered);
        }, delay);
      };
      const cancelAutomaticFlush = () => {
        if (automaticFlushTimer !== null && !automaticFlushTimerIsRetry) {
          clearTimeout(automaticFlushTimer);
          automaticFlushTimer = null;
        }
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
      }
      provider.on('synced', handleSynced);
      if (isBlockRoom) {
        onLocalEdit = () => scheduleAutomaticFlush();
      }
      onDurable = () => {
        automaticRetryPending = false;
        automaticRetryAttempt = 0;
        cancelAutomaticFlush();
      };
      const unsubscribePersisted =
        persistence.kind === 'block-room'
          ? persistence.protocol.subscribePersisted((acknowledgement) => {
              if (pendingDurabilityState && blockRoomDurabilityStateCovers(acknowledgement, pendingDurabilityState)) {
                markDurable();
              }
            })
          : () => undefined;
      const handlePersisted = ({ payload }: { payload: string }) => {
        try {
          const parsed = parseServerMessage(payload);
          if (
            !parsed.ok ||
            parsed.message.kind !== 'room.persisted' ||
            parsed.message.documentName !== provider.configuration.name
          ) {
            return;
          }
          const stateVector = Uint8Array.from(atob(parsed.message.stateVector), (character) => character.charCodeAt(0));
          if (
            pendingDurabilityState &&
            blockRoomDurabilityStateCovers({ stateVector, deleted: parsed.message.deleted }, pendingDurabilityState)
          ) {
            markDurable();
          }
        } catch (error) {
          void createLogger('collaboration').warn('Ignoring invalid durability acknowledgement', {
            data: { error: String(error) },
          });
        }
      };
      if (!isBlockRoom) {
        provider.on('stateless', handlePersisted);
      }
      const unregisterSave = registerEditorSave(key, {
        flush: () => (persistence.isParked?.() ? Promise.resolve(true) : flush(onFlushError)),
        hasPending: () => !persistence.isParked?.() && hasPending(),
        hasParked: () => persistence.isParked?.() === true && hasPending(),
        hasFailure,
        ...(persistence.isDurable ? { isDurable: persistence.isDurable } : {}),
      });
      observeRegisteredFlush = observeActiveFlush;
      if (activeFlush) {
        observeActiveFlush(activeFlush);
      }
      scheduleAutomaticFlush();

      return () => {
        registered = false;
        autoFlushRequestedWhileActive = false;
        automaticRetryPending = false;
        observedActiveFlush = null;
        if (observeRegisteredFlush === observeActiveFlush) {
          observeRegisteredFlush = null;
        }
        if (automaticFlushTimer !== null) {
          clearTimeout(automaticFlushTimer);
          automaticFlushTimer = null;
          automaticFlushTimerIsRetry = false;
        }
        if (persistence.kind === 'persist-now') {
          provider.off('unsyncedChanges', handleUnsyncedChanges);
        }
        provider.off('synced', handleSynced);
        onLocalEdit = null;
        onDurable = null;
        document.off('afterTransaction', handleAfterTransaction);
        unsubscribePersisted();
        if (!isBlockRoom) {
          provider.off('stateless', handlePersisted);
        }
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
