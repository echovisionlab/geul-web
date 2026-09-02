'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  HocuspocusProvider,
  type onAuthenticationFailedParameters,
  type onStatelessParameters,
} from '@hocuspocus/provider';
import * as Y from 'yjs';
import {
  createBlockRoomDocumentName,
  type BlockRoomBootstrap,
  type BlockRoomDocumentType,
} from '@/lib/collab/block-room-bootstrap';
import { BlockRoomProtocolClient, type BlockRoomProtocolTransport } from '@/lib/collab/block-room-protocol';
import { setHocuspocusResumeToken } from '@/lib/collab/hocuspocus-provider';
import {
  registerInteractiveMutationUndoProvider,
  type InteractiveMutationUndoRegistration,
} from '@/lib/collab/interactive-mutation-undo';
import { isBlockId } from '@/lib/editor/block-id';
import { getPublicCollabUrl } from '@/lib/public-runtime-config';

export interface BlockRoomEpochAck {
  documentRevision: string;
  targetRevision?: string;
  changed: boolean;
  sourceChanged: boolean;
  changedLocales: string[];
  locale: string;
}

export interface BlockRoomConnection {
  provider: HocuspocusProvider | null;
  /** Canonical room document, exposed only after the server accepts bootstrap parity. */
  doc: Y.Doc | null;
  bootstrap: BlockRoomBootstrap | null;
  protocol: BlockRoomProtocolTransport | null;
  isConnected: boolean;
  isSynced: boolean;
  isLoading: boolean;
  error: Error | null;
  reloadCanonical: () => void;
  acceptEpochAck: (ack: BlockRoomEpochAck) => boolean;
}

type BlockRoomConnectionState = Omit<BlockRoomConnection, 'reloadCanonical' | 'acceptEpochAck'>;

function websocketUrl(type: BlockRoomDocumentType, entityId: string, locale: string): string {
  const websocketOrigin = window.location.origin.replace(/^http/u, 'ws');
  return `${websocketOrigin}${getPublicCollabUrl()}/${type}/${entityId}/${encodeURIComponent(locale)}`;
}

function emptyConnection(overrides: Partial<BlockRoomConnectionState> = {}): BlockRoomConnectionState {
  return {
    provider: null,
    doc: null,
    bootstrap: null,
    protocol: null,
    isConnected: false,
    isSynced: false,
    isLoading: true,
    error: null,
    ...overrides,
  };
}

function canAcceptEpochAck(
  connection: BlockRoomConnectionState,
  ack: BlockRoomEpochAck,
  roomLocale: string | null,
): boolean {
  if (!connection.bootstrap) {
    return false;
  }
  if (!connection.protocol) {
    return false;
  }
  if (!roomLocale || ack.locale !== roomLocale) {
    return false;
  }
  const isSourceRoom = connection.bootstrap.sourceLocale === roomLocale;
  if (isSourceRoom === Boolean(ack.targetRevision)) {
    return false;
  }
  return true;
}

/**
 * Owns one room-resident WebSocket. Bootstrap, Yjs sync, awareness, and typed
 * metadata all share this authenticated connection and its room epoch.
 */
export function useBlockRoomConnection(
  documentType: BlockRoomDocumentType,
  entityId: string,
  locale: string | null,
): BlockRoomConnection {
  const [generation, setGeneration] = useState(0);
  const requestIdentity = `${documentType}\u0000${entityId}\u0000${locale ?? ''}\u0000${generation}`;
  const [connection, setConnection] = useState<BlockRoomConnectionState>(() => emptyConnection());
  const [connectionIdentity, setConnectionIdentity] = useState(requestIdentity);
  const reloadCanonical = useCallback(() => {
    setConnection(emptyConnection());
    setGeneration((value) => value + 1);
  }, []);
  const acceptEpochAck = useCallback(
    (ack: BlockRoomEpochAck): boolean => {
      if (connectionIdentity !== requestIdentity) {
        return false;
      }
      if (!canAcceptEpochAck(connection, ack, locale)) {
        reloadCanonical();
        return false;
      }
      setConnection((value) => ({
        ...value,
        bootstrap: value.bootstrap
          ? {
              ...value.bootstrap,
              documentRevision: ack.documentRevision,
              targetRevision: ack.targetRevision,
            }
          : null,
      }));
      return true;
    },
    [connection.bootstrap, connection.protocol, connectionIdentity, locale, reloadCanonical, requestIdentity],
  );

  useEffect(() => {
    setConnectionIdentity(requestIdentity);
    let disposed = false;
    let reloadScheduled = false;
    let residentDoc: Y.Doc | null = null;
    let residentProvider: HocuspocusProvider | null = null;
    let interactiveUndo: InteractiveMutationUndoRegistration | null = null;
    let roomProtocol: BlockRoomProtocolClient | null = null;

    const destroyResident = () => {
      roomProtocol?.destroy();
      roomProtocol = null;
      interactiveUndo?.destroy();
      interactiveUndo = null;
      residentProvider?.destroy();
      residentProvider = null;
      residentDoc?.destroy();
      residentDoc = null;
    };

    const scheduleCanonicalReload = () => {
      if (disposed || reloadScheduled) {
        return;
      }
      reloadScheduled = true;
      destroyResident();
      setConnection(emptyConnection());
      setGeneration((value) => value + 1);
    };

    if (!isBlockId(entityId)) {
      setConnection(
        emptyConnection({
          isLoading: false,
          error: new Error('Collaboration entity ID must be a UUID.'),
        }),
      );
      return () => {
        disposed = true;
      };
    }

    if (!locale) {
      setConnection(emptyConnection());
      return () => {
        disposed = true;
      };
    }

    let documentName: string;
    try {
      documentName = createBlockRoomDocumentName(documentType, entityId, locale);
    } catch (error) {
      setConnection(
        emptyConnection({
          isLoading: false,
          error: error instanceof Error ? error : new Error('Collaboration locale is invalid.'),
        }),
      );
      return () => {
        disposed = true;
      };
    }

    setConnection(emptyConnection());
    const document = new Y.Doc();
    residentDoc = document;
    let protocolReference: BlockRoomProtocolClient | null = null;
    const providerConfiguration = {
      url: websocketUrl(documentType, entityId, locale),
      name: documentName,
      document,
      maxAttempts: 20,
      onConnect: () => {
        if (!disposed && !reloadScheduled) {
          setConnection((value) => ({ ...value, isConnected: true }));
        }
      },
      onDisconnect: () => {
        if (!disposed && !reloadScheduled) {
          setConnection((value) => ({ ...value, isConnected: false, isSynced: false }));
        }
      },
      onAuthenticationFailed: ({ reason }: onAuthenticationFailedParameters) => {
        if (reason === 'reload_required') {
          scheduleCanonicalReload();
        }
      },
      onSynced: () => protocolReference?.handleProviderSynced(),
      onStateless: ({ payload }: onStatelessParameters) => {
        interactiveUndo?.handleStateless(payload);
        protocolReference?.handleStateless(payload);
      },
    } as ConstructorParameters<typeof HocuspocusProvider>[0] & { maxAttempts: number };
    residentProvider = new HocuspocusProvider(providerConfiguration);
    interactiveUndo = registerInteractiveMutationUndoProvider(document, residentProvider);
    roomProtocol = new BlockRoomProtocolClient({
      documentType,
      entityId,
      locale,
      document,
      sendStateless: (payload) => residentProvider?.sendStateless(payload),
      setResumeToken: (token) => {
        if (residentProvider) {
          setHocuspocusResumeToken(residentProvider, token);
        }
      },
      onBootstrap: (bootstrap) => {
        if (!disposed && !reloadScheduled) {
          setConnection((value) => ({ ...value, bootstrap }));
        }
      },
      onReady: () => {
        if (!disposed && !reloadScheduled) {
          setConnection((value) => ({
            ...value,
            doc: document,
            isSynced: true,
            isLoading: false,
          }));
        }
      },
      onReloadRequired: scheduleCanonicalReload,
    });
    protocolReference = roomProtocol;
    setConnection(
      emptyConnection({
        provider: residentProvider,
        protocol: roomProtocol,
      }),
    );

    return () => {
      disposed = true;
      destroyResident();
    };
  }, [documentType, entityId, generation, locale, requestIdentity]);

  const visibleConnection = connectionIdentity === requestIdentity ? connection : emptyConnection();
  return { ...visibleConnection, reloadCanonical, acceptEpochAck };
}
