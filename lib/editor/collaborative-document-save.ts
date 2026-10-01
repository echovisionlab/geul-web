'use client';

import type { HocuspocusProvider } from '@hocuspocus/provider';
import type { Transaction } from 'yjs';
import { persistCollaborativeDocumentNow } from '@/lib/collab/persist-now';
import { notifyEditorSaveStateChanged, registerEditorSave } from './editor-save-registry';

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

/** Registers local document edits as a save that navigation and unload barriers can drain. */
export function registerCollaborativeDocumentSave(provider: HocuspocusProvider, documentKey: string): () => void {
  const document = provider.document;
  let localRevision = 0;
  let durableRevision = 0;
  let activeFlush: Promise<boolean> | null = null;

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
    notifyEditorSaveStateChanged(documentKey);
  };

  const hasPending = () => localRevision > durableRevision;

  const flush = (): Promise<boolean> => {
    if (activeFlush) {
      return activeFlush;
    }

    const operation = (async () => {
      while (hasPending()) {
        const revisionBeingFlushed = localRevision;
        try {
          // Call the raw transport helper; EditorRuntimeContext.persistNow is intentionally not used.
          await persistCollaborativeDocumentNow(provider);
        } catch {
          return false;
        }
        durableRevision = Math.max(durableRevision, revisionBeingFlushed);
      }
      return true;
    })();
    activeFlush = operation;
    void operation.finally(() => {
      if (activeFlush === operation) {
        activeFlush = null;
      }
    });
    return operation;
  };

  document.on('afterTransaction', handleAfterTransaction);
  const unregisterSave = registerEditorSave(documentKey, { flush, hasPending });

  return () => {
    document.off('afterTransaction', handleAfterTransaction);
    unregisterSave();
  };
}
