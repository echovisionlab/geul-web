'use client';

import {
  accessEndedReasonFromAuthenticationFailure,
  endProviderAccess,
  getProviderAccessLevel,
  reportRoomAccessLevel,
  setProviderDocumentRevision,
} from '@/lib/collab/provider-control-state';
import {
  isAdmissionRetryReason,
  type AccessEndedReason,
  type AccessLevel,
} from '@echovisionlab/geul-common/collaboration/protocol';
import type { EditorSnapshot } from '@/features/editor/editor-snapshot';
import { createLogger } from '@/lib/utils/logger';
import { isLocalAuthorTransaction } from './local-author-origin';

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
  knownDocumentQuery,
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
import {
  beforeHocuspocusDocumentSend,
  COLLAB_FLUSH_DELAY_MS,
  createAdmissionRetry,
  type AdmissionRetry,
  flushHocuspocusUpdatesOnPageHide,
  reconnectHocuspocusProvider,
  setHocuspocusResumeToken,
} from '@/lib/collab/hocuspocus-provider';
import { persistCollaborativeDocumentNow } from '@/lib/collab/persist-now';
import {
  acknowledgeBlockRoomIntents,
  appendBlockRoomIntentChanges,
  sealBlockRoomIntents,
  hasBlockRoomIntentChanges,
  subscribeBlockRoomIntentJournal,
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
import {
  blockRoomDurabilityStateCovers,
  mergeBlockRoomDurabilityStates,
  waitForBlockRoomDurabilityAcknowledgement,
  type BlockRoomDurabilityState,
} from './block-room-durability';
import {
  getBlockRoomJournalStore,
  hasBlockRoomJournalStorageFailure,
  subscribeBlockRoomJournalStorage,
} from './block-room-journal-store';
import { blockRoomSaveKey } from '@/lib/editor/editor-save-state';
import {
  announceRestoredEditorEdits,
  notifyEditorSaveStateChanged,
  registerEditorSave,
  setEditorRoomPhase,
} from '@/lib/editor/editor-save-registry';
import { captureEditorViewRecovery } from '@/lib/editor/editor-view-recovery';
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
  provider: HocuspocusProvider | null;
  protocol: BlockRoomProtocolClient | null;
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
  initialSnapshot?: EditorSnapshot,
): BlockRoomConnection {
  const snapshotRef = useRef(initialSnapshot);
  snapshotRef.current = initialSnapshot;
  // Once collab served an omitted body that did not match it, stop offering this snapshot.
  const rejectedKnownSnapshot = useRef<EditorSnapshot | undefined>(undefined);
  const [generation, setGeneration] = useState(0);
  const scopeIdentity = `${documentType}\u0000${entityId}\u0000${locale ?? ''}`;
  const saveKey = blockRoomSaveKey(documentType, entityId);
  const retiredResidents = useRef<Array<() => void>>([]);
  // The room scope a canonical reload was requested for; a rebuild never spans two rooms.
  const reloadRequested = useRef<string | null>(null);
  const journalFailure = useRef(false);
  const restoreView = useRef<(() => void) | null>(null);
  const requestIdentity = `${documentType}\u0000${entityId}\u0000${locale ?? ''}\u0000${generation}`;
  const [connection, setConnection] = useState<BlockRoomConnectionState>(() => emptyConnection());
  // The provider editors are bound to; during a canonical rebuild it is the retained resident.
  const displayedProvider = useRef<HocuspocusProvider | null>(null);
  displayedProvider.current = connection.provider;
  const [connectionIdentity, setConnectionIdentity] = useState(scopeIdentity);
  const [recoverySnapshot, setRecoverySnapshot] = useState<BlockRoomRecoverySnapshot | null>(null);
  const recoverySnapshotRef = useRef<BlockRoomRecoverySnapshot | null>(null);
  const residentRecoverySource = useRef<ResidentRecoverySource | null>(null);
  // The room's last reported access, kept across provider generations (reportRoomAccessLevel).
  const roomAccessRef = useRef<{ scope: string; access: AccessLevel } | null>(null);
  // Replays parked intents once the snapshot reports the room editable again.
  const replayParkedIntents = useRef<() => void>(() => {});
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
        getBlockRoomJournalStore()?.writeRecovery(candidate, next);
        return next;
      });
    },
    [requestIdentity],
  );

  const reloadCanonical = useCallback(() => {
    captureRecoverySnapshot(residentRecoverySource.current);
    reloadRequested.current = scopeIdentity;
    setEditorRoomPhase(saveKey, 'reload');
    setGeneration((value) => value + 1);
  }, [captureRecoverySnapshot, saveKey, scopeIdentity]);

  useEffect(() => {
    setRecoverySnapshot((current) => {
      const next = matchesBlockRoomRecoveryScope(current, recoveryScope) ? current : null;
      recoverySnapshotRef.current = next;
      return next;
    });
  }, [documentType, entityId, locale]);

  const acceptEpochAck = useCallback(
    (ack: BlockRoomEpochAck): boolean => {
      if (connectionIdentity !== scopeIdentity) {
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
      if (connection.provider) {
        setProviderDocumentRevision(connection.provider, ack.documentRevision);
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
    [
      connection.bootstrap,
      connection.protocol,
      connectionIdentity,
      locale,
      reloadCanonical,
      requestIdentity,
      scopeIdentity,
    ],
  );

  useEffect(() => {
    setConnectionIdentity(scopeIdentity);
    let disposed = false;
    let reloadScheduled = false;
    let residentDoc: Y.Doc | null = null;
    let residentProvider: HocuspocusProvider | null = null;
    let releasePageHideFlush: (() => void) | null = null;
    let releaseSendSealing: (() => void) | null = null;
    let replayFailures = 0;
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
    let recoveryCaptureTimer: ReturnType<typeof setTimeout> | null = null;
    let replayPersistTimer: ReturnType<typeof setTimeout> | null = null;
    let replayPersistInFlight = false;
    let replayPersistPending = false;
    let replayPersistNeedsRetry = false;
    let replayPersistRetryDelayMs = 2_000;
    let terminalAccess = false;
    // The single pending readmission after edit access is granted while open.
    let cancelReconnect = () => {};
    // Readmission after a temporary refusal (collab restarting, authorization unreachable).
    let admissionRetry: AdmissionRetry | null = null;
    const journalStore = getBlockRoomJournalStore();
    // A reload batched with a scope change opens the new room fresh.
    const isRebuilding = reloadRequested.current === scopeIdentity;
    reloadRequested.current = null;
    let recoveryLoaded = false;
    let readyInFlight = false;
    let readyPublished = false;
    let transportConnected = false;
    let transportEpoch = 0;
    let readyTransportEpoch = -1;
    const setPhase = (phase: Parameters<typeof setEditorRoomPhase>[1]) => {
      if (!disposed && !reloadScheduled && !terminalAccess) {
        setEditorRoomPhase(saveKey, phase);
      }
    };
    setPhase(isRebuilding ? 'reload' : 'loading');

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
      journalStore?.writeRecovery(scope, null);
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
      const expected = getBlockRoomIntentChanges(scope).reduce<BlockRoomDurabilityState>(
        (state, change) => mergeBlockRoomDurabilityStates(state, change),
        { stateVector: new Uint8Array([0]), deleted: {} },
      );
      const abort = new AbortController();
      const acknowledgement = roomProtocol
        ? waitForBlockRoomDurabilityAcknowledgement(roomProtocol, expected, { signal: abort.signal })
        : Promise.resolve(null);
      void persistCollaborativeDocumentNow(provider)
        .then(async () => {
          if (!(await acknowledgement)) {
            throw new Error('Durability acknowledgement timed out.');
          }
          // This confirms the explicit persistence request only. The intent and
          // recovery snapshot remain until room.persisted covers them.
          replayPersistRetryDelayMs = 2_000;
        })
        .catch(() => {
          if (!isCurrentReplayPersistence(source, provider, document)) {
            return;
          }
          journalFailure.current = true;
          notifyEditorSaveStateChanged(saveKey);
          replayPersistNeedsRetry = true;
        })
        .finally(() => {
          abort.abort();
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
      // A viewer cannot save: parked intents wait for a room opened with edit access.
      if (snapshotRef.current?.editable === false || getProviderAccessLevel(source.provider) === 'view') {
        return;
      }

      // The source locale is part of the journal key, so a source/target role
      // or source-locale transition can never replay an old room's intent.
      if (source.bootstrap?.sourceLocale !== scope.sourceLocale) {
        return;
      }
      // Intents the replacement room already holds can still be unpersisted
      // (the resident room outlived a failed save). They are kept as they are,
      // never replayed again (their text would apply twice), and stay until
      // room.persisted covers them; a later rebuild over a restarted room
      // replays them then. Only intents the room lacks are replayed, and the
      // replay intent carries their rebased form. Sealing on send keeps held
      // and unsent intents in separate entries.
      const held = {
        stateVector: Y.encodeStateVector(document),
        deleted: deleteSetRecord(Y.createDeleteSetFromStructStore(document.store) as TransactionDeleteSet),
      };
      const covered = changes.filter((change) => blockRoomDurabilityStateCovers(held, change));
      const uncovered = changes.filter((change) => !covered.includes(change));
      source.replaying = true;
      replayOrigin = createCollaborativeDocumentReplayOrigin();
      replayIntent = null;
      try {
        if (uncovered.length) {
          replayBlockRoomChanges(document, uncovered, { origin: replayOrigin });
        }
      } catch {
        replayOrigin = null;
        source.replaying = false;
        journalFailure.current = true;
        notifyEditorSaveStateChanged(saveKey);
        cancelReplayPersistRetry();
        // An intent that cannot apply keeps failing; back off instead of retrying every 2 s.
        const delay = Math.min(30_000, 2_000 * 2 ** Math.min(replayFailures, 4));
        replayFailures += 1;
        replayPersistTimer = setTimeout(() => {
          replayPersistTimer = null;
          if (!disposed && !reloadScheduled && !terminalAccess) {
            replayPendingIntents();
          }
        }, delay);
        return;
      }
      replayFailures = 0;
      replayOrigin = null;
      source.replayEligible = false;

      // An uncovered intent that replay found redundant needs no persistence.
      const retained = [
        ...covered,
        ...(replayIntent && blockRoomIntentChangesCanonicalBody(scope, replayIntent) ? [replayIntent] : []),
      ];
      if (retained.length) {
        replaceBlockRoomIntentChanges(scope, retained);
        // Keep these intents until the protocol's durable snapshot hint
        // covers both their state vector and deletion ranges.
        replayPersistPending = true;
        replayPersistNeedsRetry = false;
        replayPersistRetryDelayMs = 2_000;
        attemptReplayPersistence();
      } else {
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
      if (recoveryCaptureTimer !== null) {
        clearTimeout(recoveryCaptureTimer);
      }
      cancelReplayPersistRetry();
      replayPersistPending = false;
      replayPersistNeedsRetry = false;
      roomProtocol?.destroy();
      roomProtocol = null;
      interactiveUndo?.destroy();
      interactiveUndo = null;
      releasePageHideFlush?.();
      releasePageHideFlush = null;
      releaseSendSealing?.();
      releaseSendSealing = null;
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

    const scheduleCanonicalReload = (reason?: string, reloadReason?: string) => {
      void createLogger('block-room').warn('Canonical room reload required', {
        data: { documentType, entityId, locale, reason, reloadReason },
      });
      if (disposed || reloadScheduled || terminalAccess) {
        return;
      }
      reloadScheduled = true;
      admissionRetry?.cancel();
      captureRecoverySnapshot(recoverySource);
      roomProtocol?.destroy();
      reloadRequested.current = scopeIdentity;
      setEditorRoomPhase(saveKey, 'reload');
      residentProvider?.disconnect?.();
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

    if (!isRebuilding) {
      setConnection(emptyConnection());
    }
    const document = new Y.Doc();
    residentDoc = document;
    recoverySource = {
      requestIdentity,
      documentType,
      entityId,
      locale,
      document,
      provider: null,
      protocol: null,
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
        if (recoveryCaptureTimer === null) {
          recoveryCaptureTimer = setTimeout(() => {
            recoveryCaptureTimer = null;
            captureRecoverySnapshot(recoverySource);
          }, 250);
        }
      }
    };
    document.on('update', updateListener);
    beforeTransactionListener = (transaction) => {
      const isReplay = replayOrigin !== null && transaction.origin === replayOrigin;
      if (
        !recoverySource?.admitted ||
        (!isLocalAuthorTransaction(transaction) && !isReplay) ||
        transaction.origin === residentProvider
      ) {
        return;
      }
      localTransactionBefore = decodeCanonicalBlockRoom(document, documentType);
      localTransactionOrigin = transaction.origin;
    };
    afterTransactionListener = (transaction) => {
      const isReplay = replayOrigin !== null && transaction.origin === replayOrigin;
      if (
        !recoverySource?.admitted ||
        (!isLocalAuthorTransaction(transaction) && !isReplay) ||
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
    const endAccess = (reason: AccessEndedReason) => {
      terminalAccess = true;
      cancelReconnect();
      admissionRetry?.cancel();
      // Settles outstanding requests now and stops processing later room messages.
      roomProtocol?.destroy();
      if (residentProvider) {
        endProviderAccess(residentProvider, reason);
      }
      // A replacement refused during a canonical rebuild also ends the resident still shown.
      const displayed = displayedProvider.current;
      if (isRebuilding && displayed && displayed !== residentProvider) {
        endProviderAccess(displayed, reason);
      }
      captureRecoverySnapshot(recoverySource);
      void journalStore?.flush();
      cancelReplayPersistRetry();
      residentProvider?.disconnect();
      setEditorRoomPhase(saveKey, 'offline');
      setConnection((value) => ({
        ...value,
        isLoading: false,
        isConnected: false,
        isSynced: false,
        error: new Error(reason),
      }));
    };
    let protocolReference: BlockRoomProtocolClient | null = null;
    const providerConfiguration = {
      url:
        websocketUrl(documentType, entityId, locale) +
        (snapshotRef.current === rejectedKnownSnapshot.current ? '' : knownDocumentQuery(snapshotRef.current, locale)),
      flushDelay: COLLAB_FLUSH_DELAY_MS,
      name: documentName,
      document,
      maxAttempts: 0,
      delay: 1_000,
      factor: 2,
      minDelay: 1_000,
      maxDelay: 30_000,
      jitter: true,
      onConnect: () => {
        transportConnected = true;
        if (!disposed && !reloadScheduled && !terminalAccess) {
          setPhase(isRebuilding && !readyPublished ? 'reload' : 'resyncing');
          setConnection((value) => ({ ...value, isConnected: true }));
        }
      },
      onDisconnect: () => {
        transportConnected = false;
        transportEpoch += 1;
        if (!disposed && !reloadScheduled && !terminalAccess) {
          setPhase(isRebuilding && !readyPublished ? 'reload' : 'offline');
          setConnection((value) => ({ ...value, isConnected: false, isSynced: false }));
        }
      },
      onAuthenticationFailed: ({ reason }: onAuthenticationFailedParameters) => {
        const ended = accessEndedReasonFromAuthenticationFailure(reason);
        if (ended) {
          // A readmission refused for an expired session or removed access: stop retrying.
          endAccess(ended);
          return;
        }
        if (isAdmissionRetryReason(reason)) {
          // Temporary: the resident document, journal and editor stay; the room is retried.
          setPhase('offline');
          setConnection((value) => ({ ...value, isConnected: false, isSynced: false }));
          admissionRetry?.schedule();
          return;
        }
        terminalAccess = true;
        cancelReconnect();
        admissionRetry?.cancel();
        setConnection((value) => ({ ...value, error: new Error(reason), isConnected: false, isSynced: false }));
        cancelReplayPersistRetry();
      },
      onSynced: () => {
        admissionRetry?.reset();
        protocolReference?.handleProviderSynced();
      },
      onStateless: ({ payload }: onStatelessParameters) => {
        interactiveUndo?.handleStateless(payload);
        protocolReference?.handleStateless(payload);
      },
    } as ConstructorParameters<typeof HocuspocusProvider>[0] & { maxAttempts: number };
    residentProvider = new HocuspocusProvider(providerConfiguration);
    const admittedProvider = residentProvider;
    admissionRetry = createAdmissionRetry(
      admittedProvider,
      () => !disposed && !reloadScheduled && !terminalAccess && residentProvider === admittedProvider,
    );
    // Intents recorded before a send may reach collab; later ones must not merge into them.
    releaseSendSealing = beforeHocuspocusDocumentSend(residentProvider, () => {
      const scope = intentScope(recoverySource);
      if (scope) {
        sealBlockRoomIntents(scope);
      }
    });
    releasePageHideFlush = flushHocuspocusUpdatesOnPageHide(residentProvider);
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
      initialSnapshot: snapshotRef.current,
      onAccessChanged: (access) => {
        // Downgraded to view: editing stops in place; unsaved intents stay parked in the journal
        // and replay when the room is reopened with edit access.
        // Sent on every admission (before ready, no notice), and while open when permission changes.
        const provider = residentProvider;
        if (provider) {
          const upgraded = access === 'edit' && getProviderAccessLevel(provider) === 'view';
          const remembered = roomAccessRef.current?.scope === scopeIdentity ? roomAccessRef.current.access : undefined;
          roomAccessRef.current = { scope: scopeIdentity, access };
          reportRoomAccessLevel(provider, access, remembered);
          if (upgraded && readyPublished) {
            // A fresh sync re-sends updates the server dropped while read-only; readmission
            // replays parked intents.
            cancelReconnect();
            cancelReconnect = reconnectHocuspocusProvider(
              provider,
              () => !disposed && !reloadScheduled && !terminalAccess && residentProvider === provider,
            );
          }
        }
        notifyEditorSaveStateChanged(saveKey);
      },
      onOmittedBodyRejected: () => {
        rejectedKnownSnapshot.current = snapshotRef.current;
      },
      onAccessEnded: (reason) => endAccess(reason),
      onBootstrap: (bootstrap) => {
        if (residentProvider) {
          setProviderDocumentRevision(residentProvider, bootstrap.documentRevision);
        }
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
        if (!disposed && !reloadScheduled && !isRebuilding) {
          setConnection((value) => ({ ...value, bootstrap }));
        }
      },
      onReady: () => {
        if (disposed || reloadScheduled || terminalAccess) {
          return;
        }
        readyTransportEpoch = transportEpoch;
        transportConnected = true;
        if (readyInFlight) {
          return;
        }
        readyInFlight = true;
        const ready = async () => {
          try {
            if (recoverySource && !recoverySource.admitted) {
              recoverySource.admitted = true;
              recoverySource.changedSinceAdmission = false;
            }
            const scope = intentScope(recoverySource);
            let recoveredRecords = 0;
            if (!recoveryLoaded && scope && journalStore) {
              const recovered = await journalStore.claimOrphans(scope);
              // Adoption is durable even if the room changed while IndexedDB was opening.
              appendBlockRoomIntentChanges(scope, recovered.changes);
              recoveredRecords = recovered.records;
              if (recovered.recovery) {
                recoverySnapshotRef.current = recovered.recovery;
                setRecoverySnapshot(recovered.recovery);
              }
              recoveryLoaded = true;
            }
            if (disposed || reloadScheduled || terminalAccess) {
              return;
            }
            replayPendingIntents();
            if (replayPersistNeedsRetry) {
              attemptReplayPersistence();
            }
            if (recoveredRecords && scope && !recoverySource?.replayEligible) {
              announceRestoredEditorEdits();
            }
            if (isRebuilding && !readyPublished) {
              restoreView.current = captureEditorViewRecovery();
            }
            readyPublished = true;
            const synced = transportConnected && readyTransportEpoch === transportEpoch;
            setPhase(synced ? 'synced' : transportConnected ? 'resyncing' : 'offline');
            setConnection({
              provider: residentProvider,
              protocol: roomProtocol,
              bootstrap: recoverySource?.bootstrap ?? null,
              doc: document,
              isConnected: transportConnected,
              isSynced: synced,
              isLoading: false,
              error: null,
            });
            // React consumers receive the replacement before the old document is disposed.
          } finally {
            readyInFlight = false;
          }
        };
        void ready();
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
        journalFailure.current = false;
        notifyEditorSaveStateChanged(saveKey);
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
    recoverySource.provider = residentProvider;
    recoverySource.protocol = roomProtocol;
    if (!isRebuilding) {
      setConnection(emptyConnection({ provider: residentProvider, protocol: roomProtocol }));
    }
    const retryNow = () => {
      if (
        disposed ||
        reloadScheduled ||
        terminalAccess ||
        residentProvider?.configuration.websocketProvider.status === 'connected'
      ) {
        return;
      }
      void residentProvider?.connect();
    };
    window.addEventListener('focus', retryNow);
    window.addEventListener('online', retryNow);
    replayParkedIntents.current = () => {
      if (readyPublished && !disposed && !reloadScheduled && !terminalAccess) {
        replayPendingIntents();
      }
    };

    return () => {
      disposed = true;
      cancelReconnect();
      admissionRetry?.cancel();
      replayParkedIntents.current = () => {};
      window.removeEventListener('focus', retryNow);
      window.removeEventListener('online', retryNow);
      captureRecoverySnapshot(recoverySource);
      void journalStore?.flush();
      if (reloadScheduled || reloadRequested.current === scopeIdentity) {
        roomProtocol?.destroy();
        residentProvider?.disconnect?.();
        if (recoverySource?.admitted) {
          retiredResidents.current.push(destroyResident);
        } else {
          destroyResident();
        }
      } else {
        destroyResident();
        for (const destroy of retiredResidents.current.splice(0)) {
          destroy();
        }
      }
    };
  }, [captureRecoverySnapshot, documentType, entityId, generation, locale, requestIdentity, saveKey, scopeIdentity]);

  // Edit access granted while open readmits the room before the refreshed snapshot reports it
  // editable; intents parked by the read-only snapshot replay once it does.
  const snapshotEditable = initialSnapshot?.editable !== false;
  useEffect(() => {
    if (snapshotEditable) {
      replayParkedIntents.current();
    }
  }, [snapshotEditable]);

  useEffect(() => {
    const matchingScope = (scope: BlockRoomIntentScope) =>
      scope.documentType === documentType && scope.entityId === entityId && scope.locale === locale;
    const scopes = new Map<string, BlockRoomIntentScope>();
    const bootstrap = residentRecoverySource.current?.bootstrap;
    if (locale && bootstrap) {
      scopes.set(bootstrap.sourceLocale, { documentType, entityId, locale, sourceLocale: bootstrap.sourceLocale });
    }
    const unsubscribe = subscribeBlockRoomIntentJournal((scope) => {
      if (matchingScope(scope)) {
        scopes.set(scope.sourceLocale, scope);
        notifyEditorSaveStateChanged(saveKey);
      }
    });
    const activeScopes = () => {
      const source = residentRecoverySource.current;
      if (source?.bootstrap && source.locale === locale && source.entityId === entityId) {
        scopes.set(source.bootstrap.sourceLocale, {
          documentType,
          entityId,
          locale: source.locale,
          sourceLocale: source.bootstrap.sourceLocale,
        });
      }
      return [...scopes.values()];
    };
    const unsubscribeStorage = subscribeBlockRoomJournalStorage(() => notifyEditorSaveStateChanged(saveKey));
    const unregister = registerEditorSave(saveKey, {
      hasFailure: () =>
        (journalFailure.current && activeScopes().some(hasBlockRoomIntentChanges)) ||
        hasBlockRoomJournalStorageFailure(),
      // A viewer's intents are parked on this device, not pending.
      hasPending: () =>
        getProviderAccessLevel(residentRecoverySource.current?.provider) !== 'view' &&
        activeScopes().some(hasBlockRoomIntentChanges),
      hasParked: () =>
        getProviderAccessLevel(residentRecoverySource.current?.provider) === 'view' &&
        activeScopes().some(hasBlockRoomIntentChanges),
      // Intents are mirrored to the member's IndexedDB journal; durable once it settled.
      isDurable: () => getBlockRoomJournalStore()?.isSettled() ?? false,
      flush: async () => {
        const source = residentRecoverySource.current;
        const changes = activeScopes().flatMap(getBlockRoomIntentChanges);
        if (!changes.length) {
          return true;
        }
        if (!source?.admitted || !source.provider || !source.protocol) {
          return false;
        }
        const expected = changes.reduce<BlockRoomDurabilityState>(
          (state, change) => mergeBlockRoomDurabilityStates(state, change),
          changes[0]!,
        );
        const abort = new AbortController();
        const acknowledgement = waitForBlockRoomDurabilityAcknowledgement(source.protocol, expected, {
          signal: abort.signal,
        });
        try {
          await persistCollaborativeDocumentNow(source.provider);
          return Boolean(await acknowledgement) && !activeScopes().some(hasBlockRoomIntentChanges);
        } catch {
          return false;
        } finally {
          abort.abort();
        }
      },
    });
    return () => {
      unsubscribe();
      unsubscribeStorage();
      unregister();
      setEditorRoomPhase(saveKey, null);
      for (const destroy of retiredResidents.current.splice(0)) {
        destroy();
      }
    };
  }, [documentType, entityId, locale, saveKey]);

  useEffect(() => {
    if (connection.doc) {
      for (const destroy of retiredResidents.current.splice(0)) {
        destroy();
      }
      const restore = restoreView.current;
      restoreView.current = null;
      if (!restore) {
        return;
      }
      let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(restore);
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [connection.doc]);

  const visibleConnection = connectionIdentity === scopeIdentity ? connection : emptyConnection();
  const visibleRecoverySnapshot = matchesBlockRoomRecoveryScope(recoverySnapshot, recoveryScope)
    ? recoverySnapshot
    : null;
  return { ...visibleConnection, recoverySnapshot: visibleRecoverySnapshot, reloadCanonical, acceptEpochAck };
}
