'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HocuspocusProvider,
  type onAuthenticationFailedParameters,
  type onStatelessParameters,
} from '@hocuspocus/provider';
import * as Y from 'yjs';
import {
  decodeCanonicalBlockRoom,
  replayBlockRoomChanges,
  type CanonicalBlockRoomSnapshot,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import {
  createBlockRoomDocumentName,
  type BlockRoomBootstrap,
  type BlockRoomDocumentType,
} from '@/lib/collab/block-room-bootstrap';
import { BlockRoomProtocolClient, type BlockRoomProtocolTransport } from '@/lib/collab/block-room-protocol';
import {
  createBlockRoomRecoverySnapshot,
  matchesBlockRoomRecoveryScope,
  retainBlockRoomRecoverySnapshot,
  type BlockRoomRecoverySnapshot,
} from '@/lib/collab/block-room-recovery';
import { setHocuspocusResumeToken } from '@/lib/collab/hocuspocus-provider';
import { persistCollaborativeDocumentNow } from '@/lib/collab/persist-now';
import {
  acknowledgeBlockRoomIntents,
  blockRoomIntentChangesCanonicalBody,
  getBlockRoomIntentChanges,
  recordBlockRoomIntent,
  replaceBlockRoomIntentChanges,
  type BlockRoomDeleteSet,
  type BlockRoomIntentChange,
  type BlockRoomIntentScope,
} from '@/lib/collab/block-room-intent-journal';
import {
  registerInteractiveMutationUndoProvider,
  type InteractiveMutationUndoRegistration,
} from '@/lib/collab/interactive-mutation-undo';
import { isBlockId } from '@/lib/editor/block-id';
import { createCollaborativeDocumentReplayOrigin } from '@/lib/editor/collaborative-document-save';
import { getPublicCollabUrl } from '@/lib/public-runtime-config';

export interface BlockRoomEpochAck {
  documentRevision: string;
  targetRevision?: string;
  changed: boolean;
  sourceChanged: boolean;
  changedLocales: string[];
  locale: string;
  metadataUpdate?: { sequence: number };
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
  recoverySnapshot: BlockRoomRecoverySnapshot | null;
  reloadCanonical: () => void;
  acceptEpochAck: (ack: BlockRoomEpochAck) => boolean;
}

type BlockRoomConnectionState = Omit<BlockRoomConnection, 'reloadCanonical' | 'acceptEpochAck' | 'recoverySnapshot'>;

interface ResidentRecoverySource {
  requestIdentity: string;
  documentType: BlockRoomDocumentType;
  entityId: string;
  locale: string;
  document: Y.Doc;
  bootstrap: BlockRoomBootstrap | null;
  admitted: boolean;
  changedSinceAdmission: boolean;
  replaying: boolean;
  bodyIntentDurable: boolean;
  replayEligible: boolean;
}

interface TransactionDeleteSet {
  clients: Map<number, Array<{ clock: number; len: number }>>;
}

function deleteSetRecord(deleteSet: TransactionDeleteSet): BlockRoomDeleteSet {
  return Object.fromEntries(
    [...deleteSet.clients.entries()].map(([client, ranges]) => [
      String(client),
      ranges.map(({ clock, len }) => ({ clock, len })),
    ]),
  );
}

function stateVectorCovers(actualBytes: Uint8Array, expectedBytes: Uint8Array): boolean {
  const actual = Y.decodeStateVector(actualBytes);
  const expected = Y.decodeStateVector(expectedBytes);
  for (const [client, clock] of expected) {
    if ((actual.get(client) ?? 0) < clock) {
      return false;
    }
  }
  return true;
}

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
  const [recoverySnapshot, setRecoverySnapshot] = useState<BlockRoomRecoverySnapshot | null>(null);
  const recoverySnapshotRef = useRef<BlockRoomRecoverySnapshot | null>(null);
  const residentRecoverySource = useRef<ResidentRecoverySource | null>(null);
  const recoveryScope = { documentType, entityId, locale };

  const captureRecoverySnapshot = useCallback(
    (source: ResidentRecoverySource | null) => {
      if (!source || source.requestIdentity !== requestIdentity || !source.admitted || !source.bootstrap) {
        return;
      }
      const candidate = createBlockRoomRecoverySnapshot({
        documentType: source.documentType,
        entityId: source.entityId,
        locale: source.locale,
        admitted: source.admitted,
        bootstrap: source.bootstrap,
        yjsUpdate: Y.encodeStateAsUpdate(source.document),
      });
      if (!candidate) {
        return;
      }
      const hasNewLocalChanges = source.changedSinceAdmission;
      source.changedSinceAdmission = false;
      if (source.bodyIntentDurable && !hasNewLocalChanges) {
        return;
      }
      setRecoverySnapshot((current) => {
        const next = retainBlockRoomRecoverySnapshot(current, candidate, hasNewLocalChanges);
        recoverySnapshotRef.current = next;
        return next;
      });
    },
    [requestIdentity],
  );

  const reloadCanonical = useCallback(() => {
    captureRecoverySnapshot(residentRecoverySource.current);
    setConnection(emptyConnection());
    setGeneration((value) => value + 1);
  }, [captureRecoverySnapshot]);

  useEffect(() => {
    setRecoverySnapshot((current) => {
      const next = matchesBlockRoomRecoveryScope(current, recoveryScope) ? current : null;
      recoverySnapshotRef.current = next;
      return next;
    });
  }, [documentType, entityId, locale]);

  const acceptEpochAck = useCallback(
    (ack: BlockRoomEpochAck): boolean => {
      if (connectionIdentity !== requestIdentity) {
        return false;
      }
      if (ack.metadataUpdate && ack.metadataUpdate.sequence < (connection.bootstrap?.metadataSequence ?? 0)) {
        return true;
      }
      if (!canAcceptEpochAck(connection, ack, locale)) {
        reloadCanonical();
        return false;
      }
      const recoverySource = residentRecoverySource.current;
      if (recoverySource?.requestIdentity === requestIdentity && recoverySource.admitted && recoverySource.bootstrap) {
        recoverySource.bootstrap = {
          ...recoverySource.bootstrap,
          documentRevision: ack.documentRevision,
          targetRevision: ack.targetRevision,
        };
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
    let updateListener: ((update: Uint8Array, origin: unknown) => void) | null = null;
    let beforeTransactionListener: ((transaction: Y.Transaction) => void) | null = null;
    let afterTransactionListener: ((transaction: Y.Transaction) => void) | null = null;
    let recoverySource: ResidentRecoverySource | null = null;
    let localTransactionBefore: CanonicalBlockRoomSnapshot | null = null;
    let localTransactionOrigin: unknown;
    let replayOrigin: object | null = null;
    let replayIntent: BlockRoomIntentChange | null = null;
    let replayPersistTimer: ReturnType<typeof setTimeout> | null = null;
    let replayPersistInFlight = false;
    let replayPersistPending = false;
    let replayPersistNeedsRetry = false;
    let replayPersistRetryDelayMs = 2_000;
    let terminalAccess = false;

    const intentScope = (source: ResidentRecoverySource | null): BlockRoomIntentScope | null => {
      const bootstrap = source?.bootstrap;
      if (!source || !bootstrap || !source.admitted) {
        return null;
      }
      return {
        documentType: source.documentType,
        entityId: source.entityId,
        locale: source.locale,
        sourceLocale: bootstrap.sourceLocale,
      };
    };

    const clearRecoverySnapshotForScope = (scope: BlockRoomIntentScope) => {
      setRecoverySnapshot((current) => {
        const next =
          matchesBlockRoomRecoveryScope(current, scope) && current.sourceLocale === scope.sourceLocale ? null : current;
        recoverySnapshotRef.current = next;
        return next;
      });
    };

    const cancelReplayPersistRetry = () => {
      if (replayPersistTimer !== null) {
        clearTimeout(replayPersistTimer);
        replayPersistTimer = null;
      }
    };

    const isCurrentReplayPersistence = (
      source: ResidentRecoverySource,
      provider: HocuspocusProvider,
      document: Y.Doc,
    ) =>
      replayPersistPending &&
      !terminalAccess &&
      !disposed &&
      !reloadScheduled &&
      source === recoverySource &&
      source.admitted &&
      provider === residentProvider &&
      document === residentDoc;

    const scheduleReplayPersistRetry = () => {
      const source = recoverySource;
      const provider = residentProvider;
      const document = residentDoc;
      const scope = intentScope(source);
      if (
        !source ||
        !provider ||
        !document ||
        !replayPersistNeedsRetry ||
        !isCurrentReplayPersistence(source, provider, document) ||
        !scope ||
        getBlockRoomIntentChanges(scope).length === 0 ||
        replayPersistTimer !== null ||
        replayPersistInFlight
      ) {
        return;
      }

      const delay = replayPersistRetryDelayMs;
      replayPersistRetryDelayMs = Math.min(delay * 2, 30_000);
      replayPersistTimer = setTimeout(() => {
        replayPersistTimer = null;
        attemptReplayPersistence();
      }, delay);
    };

    const attemptReplayPersistence = () => {
      const source = recoverySource;
      const provider = residentProvider;
      const document = residentDoc;
      const scope = intentScope(source);
      if (
        !source ||
        !provider ||
        !document ||
        !isCurrentReplayPersistence(source, provider, document) ||
        !scope ||
        getBlockRoomIntentChanges(scope).length === 0 ||
        replayPersistInFlight
      ) {
        cancelReplayPersistRetry();
        return;
      }

      cancelReplayPersistRetry();
      replayPersistNeedsRetry = false;
      replayPersistInFlight = true;
      void persistCollaborativeDocumentNow(provider)
        .then(() => {
          // This confirms the explicit persistence request only. The intent and
          // recovery snapshot remain until block_room.persisted covers them.
          replayPersistRetryDelayMs = 2_000;
        })
        .catch(() => {
          replayPersistNeedsRetry = true;
        })
        .finally(() => {
          replayPersistInFlight = false;
          if (recoverySource === source) {
            source.replaying = false;
          }
          if (replayPersistNeedsRetry) {
            scheduleReplayPersistRetry();
          } else if (!isCurrentReplayPersistence(source, provider, document)) {
            cancelReplayPersistRetry();
          }
        });
    };

    const replayPendingIntents = () => {
      const source = recoverySource;
      const scope = intentScope(source);
      const document = residentDoc;
      if (!source || !scope || !document || source.replaying || !source.replayEligible) {
        return;
      }
      const changes = getBlockRoomIntentChanges(scope);
      if (!changes.length) {
        source.replayEligible = false;
        return;
      }

      // The source locale is part of the journal key, so a source/target role
      // or source-locale transition can never replay an old room's intent.
      if (source.bootstrap?.sourceLocale !== scope.sourceLocale) {
        return;
      }
      source.replaying = true;
      replayOrigin = createCollaborativeDocumentReplayOrigin();
      replayIntent = null;
      try {
        replayBlockRoomChanges(document, changes, { origin: replayOrigin });
      } catch {
        replayOrigin = null;
        source.replaying = false;
        return;
      }
      replayOrigin = null;
      source.replayEligible = false;

      if (replayIntent && blockRoomIntentChangesCanonicalBody(scope, replayIntent)) {
        replaceBlockRoomIntentChanges(scope, [replayIntent]);
        // Keep the new epoch's intent until the protocol's durable snapshot
        // hint covers both its state vector and deletion ranges.
        replayPersistPending = true;
        replayPersistNeedsRetry = false;
        replayPersistRetryDelayMs = 2_000;
        attemptReplayPersistence();
      } else {
        // The canonical bootstrap already contains these changes, or a peer
        // has made them redundant. No new local clocks need persistence.
        replaceBlockRoomIntentChanges(scope, []);
        clearRecoverySnapshotForScope(scope);
        replayPersistPending = false;
        replayPersistNeedsRetry = false;
        cancelReplayPersistRetry();
        source.replaying = false;
      }
      replayIntent = null;
    };

    const destroyResident = () => {
      cancelReplayPersistRetry();
      replayPersistPending = false;
      replayPersistNeedsRetry = false;
      roomProtocol?.destroy();
      roomProtocol = null;
      interactiveUndo?.destroy();
      interactiveUndo = null;
      residentProvider?.destroy();
      residentProvider = null;
      if (residentDoc && updateListener) {
        residentDoc.off('update', updateListener);
        updateListener = null;
      }
      if (residentDoc && beforeTransactionListener) {
        residentDoc.off('beforeTransaction', beforeTransactionListener);
        beforeTransactionListener = null;
      }
      if (residentDoc && afterTransactionListener) {
        residentDoc.off('afterTransaction', afterTransactionListener);
        afterTransactionListener = null;
      }
      residentDoc?.destroy();
      residentDoc = null;
      if (residentRecoverySource.current === recoverySource) {
        residentRecoverySource.current = null;
      }
    };

    const scheduleCanonicalReload = () => {
      if (disposed || reloadScheduled) {
        return;
      }
      reloadScheduled = true;
      captureRecoverySnapshot(recoverySource);
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
    recoverySource = {
      requestIdentity,
      documentType,
      entityId,
      locale,
      document,
      bootstrap: null,
      admitted: false,
      changedSinceAdmission: false,
      replaying: false,
      bodyIntentDurable: false,
      replayEligible: false,
    };
    residentRecoverySource.current = recoverySource;
    updateListener = (_update, origin) => {
      // Hocuspocus applies incoming room updates with the provider as origin.
      if (recoverySource?.admitted && origin !== residentProvider) {
        recoverySource.changedSinceAdmission = true;
        recoverySource.bodyIntentDurable = false;
      }
    };
    document.on('update', updateListener);
    beforeTransactionListener = (transaction) => {
      const isReplay = replayOrigin !== null && transaction.origin === replayOrigin;
      if (!recoverySource?.admitted || (!transaction.local && !isReplay) || transaction.origin === residentProvider) {
        return;
      }
      localTransactionBefore = decodeCanonicalBlockRoom(document, documentType);
      localTransactionOrigin = transaction.origin;
    };
    afterTransactionListener = (transaction) => {
      const isReplay = replayOrigin !== null && transaction.origin === replayOrigin;
      if (
        !recoverySource?.admitted ||
        (!transaction.local && !isReplay) ||
        transaction.origin === residentProvider ||
        localTransactionBefore === null ||
        transaction.origin !== localTransactionOrigin
      ) {
        return;
      }
      const before = localTransactionBefore;
      localTransactionBefore = null;
      localTransactionOrigin = undefined;
      try {
        const scope = intentScope(recoverySource);
        if (!scope) {
          return;
        }
        const change: BlockRoomIntentChange = {
          before,
          after: decodeCanonicalBlockRoom(document, documentType),
          stateVector: Y.encodeStateVector(document),
          deleted: deleteSetRecord(transaction.deleteSet as TransactionDeleteSet),
        };
        if (isReplay) {
          if (blockRoomIntentChangesCanonicalBody(scope, change)) {
            replayIntent = change;
          }
          return;
        }
        if (recordBlockRoomIntent(scope, change) && recoverySource) {
          recoverySource.bodyIntentDurable = false;
        }
      } catch {
        // A local intent cannot be journaled without a complete canonical
        // before/after pair; keep the existing in-memory recovery snapshot.
      }
    };
    document.on('beforeTransaction', beforeTransactionListener);
    document.on('afterTransaction', afterTransactionListener);
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
          return;
        }
        terminalAccess = true;
        cancelReplayPersistRetry();
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
        if (recoverySource) {
          const previous = recoverySource.bootstrap;
          if (
            !previous ||
            previous.bootstrapChallenge !== bootstrap.bootstrapChallenge ||
            previous.roomEpoch !== bootstrap.roomEpoch
          ) {
            recoverySource.replayEligible = true;
          }
          recoverySource.bootstrap = bootstrap;
        }
        if (!disposed && !reloadScheduled) {
          setConnection((value) => ({ ...value, bootstrap }));
        }
      },
      onReady: () => {
        if (recoverySource && !recoverySource.admitted) {
          recoverySource.admitted = true;
          recoverySource.changedSinceAdmission = false;
        }
        replayPendingIntents();
        if (replayPersistNeedsRetry) {
          attemptReplayPersistence();
        }
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
    roomProtocol.subscribePersisted((acknowledgement) => {
      const scope = intentScope(recoverySource);
      if (!scope) {
        return;
      }
      const result = acknowledgeBlockRoomIntents(scope, acknowledgement);
      const coversCurrentState = Boolean(
        recoverySource && stateVectorCovers(acknowledgement.stateVector, Y.encodeStateVector(recoverySource.document)),
      );
      if (result.acknowledged > 0 && result.pending === 0 && coversCurrentState) {
        replayPersistPending = false;
        replayPersistNeedsRetry = false;
        cancelReplayPersistRetry();
        clearRecoverySnapshotForScope(scope);
        if (recoverySource) {
          recoverySource.changedSinceAdmission = false;
          recoverySource.bodyIntentDurable = true;
        }
      }
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
  }, [captureRecoverySnapshot, documentType, entityId, generation, locale, requestIdentity]);

  const visibleConnection = connectionIdentity === requestIdentity ? connection : emptyConnection();
  const visibleRecoverySnapshot = matchesBlockRoomRecoveryScope(recoverySnapshot, recoveryScope)
    ? recoverySnapshot
    : null;
  return { ...visibleConnection, recoverySnapshot: visibleRecoverySnapshot, reloadCanonical, acceptEpochAck };
}
