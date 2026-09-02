'use client';

import { useEffect, useRef, useState } from 'react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { parseDocumentName } from '@echovisionlab/geul-common/collaboration/document';
import * as Y from 'yjs';
import { getPublicCollabUrl } from '@/lib/public-runtime-config';

export interface HocuspocusConnectionOptions {
  documentName: string | null;
  onSynced?: (doc: Y.Doc) => void;
  connectionKey?: string | number | null;
}

export interface HocuspocusConnection {
  provider: HocuspocusProvider | null;
  doc: Y.Doc | null;
  isConnected: boolean;
  isSynced: boolean;
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
}: HocuspocusConnectionOptions): HocuspocusConnection {
  const requestIdentity = `${documentName ?? ''}\u0000${String(connectionKey ?? '')}`;
  const [connectionIdentity, setConnectionIdentity] = useState(requestIdentity);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);

  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  useEffect(() => {
    setConnectionIdentity(requestIdentity);
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
          setIsSynced(true);
          onSyncedRef.current?.(newDoc);
        }
      },
      onAuthenticationFailed: () => {
        if (cleanedUp) {
          return;
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
      newProvider.destroy();
      newDoc.destroy();
      setProvider(null);
      setDoc(null);
      setIsConnected(false);
      setIsSynced(false);
    };
  }, [connectionKey, documentName, requestIdentity]);

  if (connectionIdentity !== requestIdentity) {
    return { provider: null, doc: null, isConnected: false, isSynced: false };
  }
  return { provider, doc, isConnected, isSynced };
}
