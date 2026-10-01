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
  let activeFlush: Promise<boolean> | null = null;
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

  const flush = (onError?: (error: unknown) => void): Promise<boolean> => {
    if (activeFlush) {
      return activeFlush;
    }

    const operation = (async () => {
      for (let round = 0; round < MAX_FLUSH_ROUNDS; round += 1) {
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

    activeFlush = operation;
    void operation.finally(() => {
      if (activeFlush === operation) {
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
      document.on('afterTransaction', handleAfterTransaction);
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

      return () => {
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
