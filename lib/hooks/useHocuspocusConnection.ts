'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { CollaborativeDocumentType, parseDocumentName } from '@echovisionlab/geul-common/collaboration/document';
import * as Y from 'yjs';
import { captureDocumentRoomSnapshot, replayDocumentRoomChanges } from '@/lib/collab/document-room-intent';
import {
  acknowledgeDocumentRoomIntents,
  getDocumentRoomIntentBatch,
  hasDocumentRoomIntents,
  recordDocumentRoomIntent,
} from '@/lib/collab/document-room-intent-journal';
import { persistCollaborativeDocumentNow } from '@/lib/collab/persist-now';
import {
  createCollaborativeDocumentReplayOrigin,
  isCollaborativeDocumentReplayOrigin,
} from '@/lib/editor/collaborative-document-save';
import { notifyEditorSaveStateChanged, registerEditorSave } from '@/lib/editor/editor-save-registry';
import { getPublicCollabUrl } from '@/lib/public-runtime-config';

export interface HocuspocusConnectionOptions {
  documentName: string | null;
  onSynced?: (doc: Y.Doc) => void;
  connectionKey?: string | number | null;
  onReloadRequired?: (reloadCanonical: () => boolean) => void;
}

export interface HocuspocusConnection {
  provider: HocuspocusProvider | null;
  doc: Y.Doc | null;
  isConnected: boolean;
  isSynced: boolean;
  reloadCanonical: () => boolean;
}

type CanonicalReloadMode = 'map-theme' | 'automatic';

function getCanonicalReloadMode(documentName: string | null): CanonicalReloadMode | null {
  if (!documentName) {
    return null;
  }
  try {
    const parsed = parseDocumentName(documentName);
    switch (parsed.type) {
      case CollaborativeDocumentType.MAP_THEME:
        return parsed.locale === 'und' ? 'map-theme' : null;
      case CollaborativeDocumentType.FORM:
      case CollaborativeDocumentType.MENU:
      case CollaborativeDocumentType.POST_SERIES:
      case CollaborativeDocumentType.EMAIL_LAYOUT:
        return 'automatic';
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function getDocumentRoomSaveKey(documentName: string | null): string | null {
  if (!documentName) {
    return null;
  }
  try {
    const parsed = parseDocumentName(documentName);
    switch (parsed.type) {
      case CollaborativeDocumentType.FORM:
        return `form:${parsed.entityId}`;
      case CollaborativeDocumentType.MENU:
        return `menu:${parsed.entityId}`;
      case CollaborativeDocumentType.POST_SERIES:
        return `post_series:${parsed.entityId}`;
      case CollaborativeDocumentType.EMAIL_LAYOUT:
        return `email_layout:${parsed.entityId}`;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function buildCollaborationWebsocketUrl(documentName: string, origin: string, baseUrl: string): string {
  const parsed = parseDocumentName(documentName);
  const separatorIndex = documentName.indexOf(':');
  const type = documentName.slice(0, separatorIndex);
  const websocketOrigin = origin.replace(/^http/u, 'ws');
  return `${websocketOrigin}${baseUrl}/${type}/${parsed.entityId}/${encodeURIComponent(parsed.locale)}`;
}

export function useHocuspocusConnection({
  documentName,
  onSynced,
  connectionKey = null,
  onReloadRequired,
}: HocuspocusConnectionOptions): HocuspocusConnection {
  const [canonicalReloadSequence, setCanonicalReloadSequence] = useState(0);
  const requestIdentity = `${documentName ?? ''}\u0000${String(connectionKey ?? '')}`;
  const activeIdentity = `${requestIdentity}\u0000${canonicalReloadSequence}`;
  const [connectionIdentity, setConnectionIdentity] = useState(activeIdentity);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const syncedDocumentsRef = useRef(new WeakSet<Y.Doc>());
  const reloadPendingDocumentsRef = useRef(new WeakSet<Y.Doc>());
  const providerRef = useRef(provider);
  const docRef = useRef(doc);
  const documentNameRef = useRef(documentName);
  const isSyncedRef = useRef(isSynced);
  const scheduleDocumentRoomFlushRef = useRef<() => void>(() => undefined);
  const flushDocumentRoomIntentsRef = useRef<() => Promise<boolean>>(async () => true);
  providerRef.current = provider;
  docRef.current = doc;
  documentNameRef.current = documentName;
  isSyncedRef.current = isSynced;

  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;
  const onReloadRequiredRef = useRef(onReloadRequired);
  onReloadRequiredRef.current = onReloadRequired;

  const reloadCanonical = useCallback(() => {
    if (!getCanonicalReloadMode(documentName)) {
      return false;
    }
    setCanonicalReloadSequence((sequence) => sequence + 1);
    return true;
  }, [documentName]);
  const reloadCanonicalRef = useRef(reloadCanonical);
  reloadCanonicalRef.current = reloadCanonical;

  useEffect(() => {
    setConnectionIdentity(activeIdentity);
    if (!documentName) {
      setProvider(null);
      setDoc(null);
      setIsConnected(false);
      setIsSynced(false);
      return;
    }
    const baseUrl = getPublicCollabUrl();
    if (!baseUrl) {
      return;
    }

    try {
      parseDocumentName(documentName);
    } catch {
      return;
    }

    // Hocuspocus needs an absolute WebSocket URL, but the browser must stay on
    // the Web origin so the host-only session cookie is sent by the gateway.
    const url = buildCollaborationWebsocketUrl(documentName, window.location.origin, baseUrl);

    let cleanedUp = false;
    let terminalAuthFailure = false;
    let reloadRequested = false;
    const reloadMode = getCanonicalReloadMode(documentName);

    const newDoc = new Y.Doc();
    const providerConfig = {
      url,
      name: documentName,
      document: newDoc,
      // Prevent infinite retry loops when endpoint/session is permanently invalid.
      maxAttempts: 20,
      onConnect: () => {
        if (!cleanedUp) {
          setIsConnected(true);
        }
      },
      onDisconnect: () => {
        if (!cleanedUp) {
          setIsConnected(false);
          setIsSynced(false);
        }
      },
      onSynced: () => {
        if (!cleanedUp) {
          syncedDocumentsRef.current.add(newDoc);
          setIsSynced(true);
          onSyncedRef.current?.(newDoc);
        }
      },
      onAuthenticationFailed: ({ reason }: { reason: string }) => {
        if (cleanedUp || terminalAuthFailure || reloadRequested) {
          return;
        }

        if (reason === 'reload_required' && reloadMode !== null) {
          const isMapTheme = reloadMode === 'map-theme';
          if (!isMapTheme || onReloadRequiredRef.current) {
            reloadRequested = true;
            reloadPendingDocumentsRef.current.add(newDoc);
            setIsConnected(false);
            setIsSynced(false);
            newProvider.disconnect();
            if (isMapTheme) {
              onReloadRequiredRef.current?.(reloadCanonicalRef.current);
            } else {
              reloadCanonicalRef.current();
            }
            return;
          }
        }

        terminalAuthFailure = true;
        setIsConnected(false);
        setIsSynced(false);
        newProvider.disconnect();
      },
      onClose: ({ event }: { event?: { code?: number } }) => {
        if (cleanedUp) {
          return;
        }

        const closeCode = event?.code;
        if (closeCode === 4401 || closeCode === 4403 || closeCode === 1008) {
          terminalAuthFailure = true;
          setIsConnected(false);
          setIsSynced(false);
          newProvider.disconnect();
        }
      },
    } as ConstructorParameters<typeof HocuspocusProvider>[0] & { maxAttempts: number };

    const newProvider = new HocuspocusProvider(providerConfig);

    const handleStateless = ({ payload }: { payload?: string }) => {
      const isMapTheme = reloadMode === 'map-theme';
      if (
        cleanedUp ||
        terminalAuthFailure ||
        reloadRequested ||
        reloadMode === null ||
        (isMapTheme && !onReloadRequiredRef.current)
      ) {
        return;
      }
      try {
        const signal = JSON.parse(payload ?? '') as { kind?: unknown; reason?: unknown };
        if (signal.kind !== 'reload_required' || (signal.reason !== undefined && signal.reason !== 'reload_required')) {
          return;
        }
      } catch {
        return;
      }

      reloadRequested = true;
      reloadPendingDocumentsRef.current.add(newDoc);
      newProvider.disconnect();
      if (isMapTheme) {
        onReloadRequiredRef.current?.(reloadCanonicalRef.current);
      } else {
        // Form schema patches and document-room semantic intents replay only on
        // a fresh, server-synced canonical provider.
        reloadCanonicalRef.current();
      }
    };
    newProvider.on('stateless', handleStateless);

    const reconnectIfRecoverable = () => {
      if (cleanedUp || terminalAuthFailure) {
        return;
      }

      void newProvider.connect();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      reconnectIfRecoverable();
    };

    window.addEventListener('online', reconnectIfRecoverable);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    setProvider(newProvider);
    setDoc(newDoc);

    return () => {
      cleanedUp = true;
      window.removeEventListener('online', reconnectIfRecoverable);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      newProvider.off('stateless', handleStateless);
      newProvider.destroy();
      newDoc.destroy();
      setProvider(null);
      setDoc(null);
      setIsConnected(false);
      setIsSynced(false);
    };
  }, [activeIdentity, connectionKey, documentName, requestIdentity]);

  const documentRoomSaveKey = getDocumentRoomSaveKey(documentName);

  useEffect(() => {
    if (!doc || !provider || !documentName || !documentRoomSaveKey) {
      scheduleDocumentRoomFlushRef.current = () => undefined;
      return;
    }

    const beforeSnapshots = new WeakMap<Y.Transaction, ReturnType<typeof captureDocumentRoomSnapshot>>();
    const captureBeforeTransaction = (transaction: Y.Transaction) => {
      if (
        !syncedDocumentsRef.current.has(doc) ||
        !transaction.local ||
        transaction.origin === provider ||
        isCollaborativeDocumentReplayOrigin(transaction.origin)
      ) {
        return;
      }
      beforeSnapshots.set(transaction, captureDocumentRoomSnapshot(documentName, doc));
    };
    const captureAfterTransaction = (transaction: Y.Transaction) => {
      const before = beforeSnapshots.get(transaction);
      beforeSnapshots.delete(transaction);
      if (
        !before ||
        transaction.changed.size === 0 ||
        !transaction.local ||
        transaction.origin === provider ||
        isCollaborativeDocumentReplayOrigin(transaction.origin)
      ) {
        return;
      }
      const after = captureDocumentRoomSnapshot(documentName, doc);
      if (after && recordDocumentRoomIntent(documentName, { before, after }, doc)) {
        notifyEditorSaveStateChanged(documentRoomSaveKey);
        scheduleDocumentRoomFlushRef.current();
      }
    };

    doc.on('beforeTransaction', captureBeforeTransaction);
    doc.on('afterTransaction', captureAfterTransaction);
    return () => {
      doc.off('beforeTransaction', captureBeforeTransaction);
      doc.off('afterTransaction', captureAfterTransaction);
    };
  }, [doc, documentName, documentRoomSaveKey, provider]);

  useEffect(() => {
    if (!doc || !provider || !documentName || !documentRoomSaveKey) {
      flushDocumentRoomIntentsRef.current = async () => true;
      return;
    }

    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryAttempt = 0;
    let activeFlush: Promise<boolean> | null = null;

    const isCurrentProvider = () =>
      !disposed &&
      !reloadPendingDocumentsRef.current.has(doc) &&
      providerRef.current === provider &&
      docRef.current === doc &&
      documentNameRef.current === documentName;

    const clearRetryTimer = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const scheduleRetry = () => {
      if (!isCurrentProvider() || !isSyncedRef.current) {
        return;
      }
      clearRetryTimer();
      retryAttempt += 1;
      const delay = Math.min(30_000, 2_000 * 2 ** Math.min(retryAttempt - 1, 4));
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void flush();
      }, delay);
    };

    const flush = (): Promise<boolean> => {
      if (activeFlush) {
        return activeFlush;
      }
      if (!isCurrentProvider() || !isSyncedRef.current || !syncedDocumentsRef.current.has(doc)) {
        return Promise.resolve(false);
      }

      const operation = (async () => {
        while (isCurrentProvider() && isSyncedRef.current) {
          const currentSnapshot = captureDocumentRoomSnapshot(documentName, doc);
          if (!currentSnapshot) {
            return !hasDocumentRoomIntents(documentName, null);
          }
          const batch = getDocumentRoomIntentBatch(documentName, currentSnapshot, doc);
          if (batch.changes.length === 0) {
            return !hasDocumentRoomIntents(documentName, currentSnapshot);
          }

          try {
            if (batch.requiresReplay) {
              replayDocumentRoomChanges(documentName, doc, batch.changes, createCollaborativeDocumentReplayOrigin());
            }
            await persistCollaborativeDocumentNow(provider);
          } catch {
            scheduleRetry();
            return false;
          }

          if (!isCurrentProvider() || !isSyncedRef.current) {
            return false;
          }
          if (!acknowledgeDocumentRoomIntents(documentName, batch.changes)) {
            scheduleRetry();
            return false;
          }
          retryAttempt = 0;
          notifyEditorSaveStateChanged(documentRoomSaveKey);
        }
        return false;
      })();
      activeFlush = operation;
      void operation.finally(() => {
        if (activeFlush === operation) {
          activeFlush = null;
        }
      });
      return operation;
    };

    const scheduleLocalFlush = () => {
      clearRetryTimer();
      retryAttempt = 0;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void flush();
      }, 2_000);
    };
    scheduleDocumentRoomFlushRef.current = scheduleLocalFlush;
    flushDocumentRoomIntentsRef.current = flush;

    const unregister = registerEditorSave(documentRoomSaveKey, {
      hasPending: () => hasDocumentRoomIntents(documentName, captureDocumentRoomSnapshot(documentName, doc)),
      flush,
    });

    return () => {
      disposed = true;
      clearRetryTimer();
      if (scheduleDocumentRoomFlushRef.current === scheduleLocalFlush) {
        scheduleDocumentRoomFlushRef.current = () => undefined;
      }
      if (flushDocumentRoomIntentsRef.current === flush) {
        flushDocumentRoomIntentsRef.current = async () => true;
      }
      unregister();
    };
  }, [doc, documentName, documentRoomSaveKey, provider]);

  useEffect(() => {
    if (!provider || !doc || !documentName || !documentRoomSaveKey || !isSynced) {
      return;
    }
    void flushDocumentRoomIntentsRef.current();
  }, [doc, documentName, documentRoomSaveKey, isSynced, provider]);

  if (connectionIdentity !== activeIdentity) {
    return { provider: null, doc: null, isConnected: false, isSynced: false, reloadCanonical };
  }
  return { provider, doc, isConnected, isSynced, reloadCanonical };
}
