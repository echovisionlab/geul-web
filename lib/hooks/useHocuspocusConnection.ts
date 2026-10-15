'use client';

import { blockRoomDurabilityStateCovers } from '@/lib/collab/block-room-durability';
import {
  accessEndedReasonFromAuthenticationFailure,
  endProviderAccess,
  getProviderAccessLevel,
  reportRoomAccessLevel,
} from '@/lib/collab/provider-control-state';
import {
  type AccessLevel,
  isAdmissionRetryReason,
  parseServerMessage,
} from '@echovisionlab/geul-common/collaboration/protocol';
import {
  COLLAB_FLUSH_DELAY_MS,
  flushHocuspocusUpdatesOnPageHide,
  createAdmissionRetry,
  reconnectHocuspocusProvider,
} from '@/lib/collab/hocuspocus-provider';
import { createLogger } from '@/lib/utils/logger';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { CollaborativeDocumentType, parseDocumentName } from '@echovisionlab/geul-common/collaboration/document';
import * as Y from 'yjs';
import { captureDocumentRoomSnapshot, replayDocumentRoomChanges } from '@/lib/collab/document-room-intent';
import { getDocumentRoomJournalStore } from '@/lib/collab/document-room-journal-store';
import { getActiveMember } from '@/lib/auth/active-member';
import {
  acknowledgeDocumentRoomIntents,
  appendDocumentRoomIntents,
  getDocumentRoomIntentBatch,
  hasDocumentRoomIntents,
  recordDocumentRoomIntent,
} from '@/lib/collab/document-room-intent-journal';
import { persistCollaborativeDocumentNow } from '@/lib/collab/persist-now';
import {
  createCollaborativeDocumentReplayOrigin,
  isCollaborativeDocumentReplayOrigin,
} from '@/lib/editor/collaborative-document-save';
import {
  notifyEditorSaveStateChanged,
  registerEditorSave,
  setEditorRoomPhase,
} from '@/lib/editor/editor-save-registry';
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
  // The room's last reported access, kept across provider generations (reportRoomAccessLevel).
  const roomAccessRef = useRef<{ documentName: string; access: AccessLevel } | null>(null);
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
    // The single pending readmission after edit access is granted while open.
    let cancelReconnect = () => {};
    const reloadMode = getCanonicalReloadMode(documentName);

    const newDoc = new Y.Doc();
    // Mirrors this room's intents to IndexedDB from the first local edit on.
    const journalStore = getDocumentRoomJournalStore();
    let orphansClaimed = false;
    const adoptOrphanedIntents = () => {
      if (orphansClaimed || !journalStore) {
        return;
      }
      orphansClaimed = true;
      const member = getActiveMember();
      void journalStore.claimOrphans({ documentName }).then((claimed) => {
        if (getActiveMember() !== member || !appendDocumentRoomIntents(documentName, claimed.changes)) {
          return;
        }
        const saveKey = getDocumentRoomSaveKey(documentName);
        if (saveKey) {
          notifyEditorSaveStateChanged(saveKey);
        }
        scheduleDocumentRoomFlushRef.current();
      });
    };
    const providerConfig = {
      url,
      name: documentName,
      document: newDoc,
      flushDelay: COLLAB_FLUSH_DELAY_MS,
      // Prevent infinite retry loops when endpoint/session is permanently invalid.
      maxAttempts: 20,
      onConnect: () => {
        if (!cleanedUp && !terminalAuthFailure) {
          setIsConnected(true);
        }
      },
      onDisconnect: () => {
        if (!cleanedUp && !terminalAuthFailure) {
          setIsConnected(false);
          setIsSynced(false);
        }
      },
      onSynced: () => {
        if (!cleanedUp && !terminalAuthFailure) {
          admissionRetry.reset();
          syncedDocumentsRef.current.add(newDoc);
          setIsSynced(true);
          onSyncedRef.current?.(newDoc);
          // Unsaved intents a closed tab or an earlier session of this member left for the room.
          adoptOrphanedIntents();
        }
      },
      onAuthenticationFailed: ({ reason }: { reason: string }) => {
        if (cleanedUp || terminalAuthFailure || reloadRequested) {
          return;
        }
        if (isAdmissionRetryReason(reason)) {
          // Collab is restarting or authorization is unreachable: keep the room and retry.
          setIsConnected(false);
          setIsSynced(false);
          admissionRetry.schedule();
          return;
        }

        terminalAuthFailure = true;
        admissionRetry.cancel();
        cancelReconnect();
        const ended = accessEndedReasonFromAuthenticationFailure(reason);
        if (ended) {
          endProviderAccess(newProvider, ended);
        }
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
          admissionRetry.cancel();
          setIsConnected(false);
          setIsSynced(false);
          newProvider.disconnect();
        }
      },
    } as ConstructorParameters<typeof HocuspocusProvider>[0] & { maxAttempts: number };

    const newProvider = new HocuspocusProvider(providerConfig);
    const admissionRetry = createAdmissionRetry(
      newProvider,
      () => !cleanedUp && !terminalAuthFailure && !reloadRequested,
    );
    const releasePageHideFlush = flushHocuspocusUpdatesOnPageHide(newProvider);

    const handleStateless = ({ payload }: { payload?: string }) => {
      try {
        if (cleanedUp || terminalAuthFailure || reloadRequested) {
          return;
        }
        const parsed = parseServerMessage(payload ?? '');
        if (!parsed.ok) {
          void createLogger('collaboration').warn('Ignoring collaboration message', { data: { ...parsed } });
          return;
        }
        if (parsed.message.kind === 'room.persisted' && parsed.message.documentName === documentName) {
          const snapshot = captureDocumentRoomSnapshot(documentName, newDoc);
          const batch = getDocumentRoomIntentBatch(documentName, snapshot, newDoc);
          const stateVector = Uint8Array.from(atob(parsed.message.stateVector), (character) => character.charCodeAt(0));
          const expected = {
            stateVector: Y.encodeStateVector(newDoc),
            deleted: Object.fromEntries(Y.decodeUpdate(Y.encodeStateAsUpdate(newDoc)).ds.clients),
          };
          if (
            !batch.requiresReplay &&
            blockRoomDurabilityStateCovers({ stateVector, deleted: parsed.message.deleted }, expected)
          ) {
            acknowledgeDocumentRoomIntents(documentName, batch.changes);
            const saveKey = getDocumentRoomSaveKey(documentName);
            if (saveKey) {
              notifyEditorSaveStateChanged(saveKey);
            }
          }
          return;
        }
        if (parsed.message.kind === 'room.access_changed') {
          // Downgraded to view: editing stops; unsaved intents stay parked in this member's journal.
          // Sent on every admission, and while open when permission changes.
          const { access } = parsed.message;
          const upgraded = access === 'edit' && getProviderAccessLevel(newProvider) === 'view';
          const remembered =
            roomAccessRef.current?.documentName === documentName ? roomAccessRef.current.access : undefined;
          roomAccessRef.current = { documentName, access };
          reportRoomAccessLevel(newProvider, access, remembered);
          if (upgraded && syncedDocumentsRef.current.has(newDoc)) {
            // Updates the server dropped while read-only are re-sent by a fresh sync; parked
            // intents follow through the room's flush.
            cancelReconnect();
            cancelReconnect = reconnectHocuspocusProvider(
              newProvider,
              () => !cleanedUp && !terminalAuthFailure && !reloadRequested,
            );
          }
          const saveKey = getDocumentRoomSaveKey(documentName);
          if (saveKey) {
            notifyEditorSaveStateChanged(saveKey);
          }
          return;
        }
        if (parsed.message.kind === 'room.access_ended') {
          terminalAuthFailure = true;
          cancelReconnect();
          admissionRetry.cancel();
          endProviderAccess(newProvider, parsed.message.reason);
          const saveKey = getDocumentRoomSaveKey(documentName);
          if (saveKey) {
            setEditorRoomPhase(saveKey, 'offline');
          }
          isSyncedRef.current = false;
          setIsConnected(false);
          setIsSynced(false);
          newProvider.disconnect();
          return;
        }
        const isMapTheme = reloadMode === 'map-theme';
        if (
          parsed.message.kind !== 'room.reload' ||
          reloadMode === null ||
          (isMapTheme && !onReloadRequiredRef.current)
        ) {
          return;
        }

        reloadRequested = true;
        cancelReconnect();
        admissionRetry.cancel();
        reloadPendingDocumentsRef.current.add(newDoc);
        newProvider.disconnect();
        if (isMapTheme) {
          onReloadRequiredRef.current?.(reloadCanonicalRef.current);
        } else {
          // Form schema patches and document-room semantic intents replay only on
          // a fresh, server-synced canonical provider.
          reloadCanonicalRef.current();
        }
      } catch (error) {
        void createLogger('collaboration').warn('Ignoring invalid collaboration message', {
          data: { error: String(error) },
        });
      }
    };
    newProvider.on('stateless', handleStateless);

    const reconnectIfRecoverable = () => {
      if (cleanedUp || terminalAuthFailure || reloadRequested) {
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
      cancelReconnect();
      admissionRetry.cancel();
      window.removeEventListener('online', reconnectIfRecoverable);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releasePageHideFlush();
      newProvider.off('stateless', handleStateless);
      const saveKey = getDocumentRoomSaveKey(documentName);
      if (saveKey) {
        setEditorRoomPhase(saveKey, null);
      }
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

      if (getProviderAccessLevel(provider) === 'view') {
        // Parked until edit access returns; nothing is sent from a read-only connection.
        return Promise.resolve(true);
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
            if (!hasDocumentRoomIntents(documentName, captureDocumentRoomSnapshot(documentName, doc))) {
              return true;
            }
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
      // A viewer cannot save: its intents are parked (kept on this device), not pending.
      hasPending: () =>
        getProviderAccessLevel(provider) !== 'view' &&
        hasDocumentRoomIntents(documentName, captureDocumentRoomSnapshot(documentName, doc)),
      hasParked: () =>
        getProviderAccessLevel(provider) === 'view' &&
        hasDocumentRoomIntents(documentName, captureDocumentRoomSnapshot(documentName, doc)),
      // Intents are mirrored to the member's IndexedDB journal; durable once it settled.
      isDurable: () => getDocumentRoomJournalStore()?.isSettled() ?? false,
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
