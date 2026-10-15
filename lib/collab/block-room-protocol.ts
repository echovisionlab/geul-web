import {
  encodeMessage,
  parseServerMessage,
  type MetadataUpdate,
  type MetadataAck,
  type MetadataOperation,
  type RoomRevision,
  type DurabilityCoverage,
  type AccessEndedReason,
  type AccessLevel,
} from '@echovisionlab/geul-common/collaboration/protocol';
import type { EditorSnapshot } from '@/features/editor/editor-snapshot';
import { createLogger } from '@/lib/utils/logger';
import { UnretryableSaveError } from '@/lib/editor/save-failure';
import * as Y from 'yjs';
import {
  applyBlockRoomBootstrap,
  parseBlockRoomBootstrap,
  type BlockRoomBootstrap,
  type BlockRoomDocumentType,
} from '@/lib/collab/block-room-bootstrap';

export interface BlockRoomPersistedState {
  stateVector: Uint8Array;
  deleted: DurabilityCoverage['deleted'];
}
export type BlockRoomMetadataUpdate = MetadataUpdate;
export type BlockRoomMetadataAck = MetadataAck;
export type BlockRoomSnapshot = RoomRevision;
export type BlockRoomMetadataOperation = MetadataOperation;

export class BlockRoomProtocolError extends Error {
  constructor(
    message: string,
    readonly reloadRequired = false,
  ) {
    super(message);
    this.name = 'BlockRoomProtocolError';
  }
}

export interface BlockRoomProtocolTransport {
  readonly documentName?: string;
  subscribeReady?: (listener: () => void) => () => void;
  subscribePersisted?: (listener: (state: BlockRoomPersistedState) => void) => () => void;
  subscribeMetadata?: (listener: (update: BlockRoomMetadataUpdate) => void) => () => void;
  updateMetadata: (
    operation: BlockRoomMetadataOperation,
    payload: unknown,
    signal?: AbortSignal,
  ) => Promise<BlockRoomMetadataAck>;
  getSnapshot: (signal?: AbortSignal) => Promise<BlockRoomSnapshot>;
}

interface PendingRequest {
  resolve: (value: BlockRoomMetadataAck) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  cleanupAbort?: () => void;
}

interface PendingSnapshotRequest {
  resolve: (value: BlockRoomSnapshot) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  cleanupAbort?: () => void;
}

interface BlockRoomProtocolClientOptions {
  documentType: BlockRoomDocumentType;
  entityId: string;
  locale: string;
  document: Y.Doc;
  sendStateless: (payload: string) => void;
  setResumeToken: (token: string) => void;
  onBootstrap: (bootstrap: BlockRoomBootstrap) => void;
  onReady: () => void;
  initialSnapshot?: EditorSnapshot;
  onAccessEnded?: (reason: AccessEndedReason) => void;
  /** The room's access level changed while it stays open (room.access_changed). */
  onAccessChanged?: (access: AccessLevel) => void;
  onReloadRequired: (reason?: string, reloadReason?: string) => void;
  /** A bootstrap that omitted the body did not match the snapshot this client offered. */
  onOmittedBodyRejected?: () => void;
}

function stateVectorIncludes(actualBytes: Uint8Array, expectedBytes: Uint8Array): boolean {
  const actual = Y.decodeStateVector(actualBytes);
  const expected = Y.decodeStateVector(expectedBytes);
  for (const [client, clock] of expected) {
    if ((actual.get(client) ?? 0) < clock) {
      return false;
    }
  }
  return true;
}

export class BlockRoomProtocolClient implements BlockRoomProtocolTransport {
  private bootstrapStateVector: Uint8Array | null = null;
  private bootstrap: BlockRoomBootstrap | null = null;
  private providerSynced = false;
  private ackSent = false;
  private ready = false;
  private destroyed = false;
  private readonly readyListeners = new Set<() => void>();
  private readonly persistedListeners = new Set<(state: BlockRoomPersistedState) => void>();
  private readonly metadataListeners = new Set<(update: BlockRoomMetadataUpdate) => void>();
  private readonly pending = new Map<string, PendingRequest>();
  private readonly pendingSnapshots = new Map<string, PendingSnapshotRequest>();

  constructor(private readonly options: BlockRoomProtocolClientOptions) {}

  handleProviderSynced(): void {
    this.providerSynced = true;
    if (this.ready) {
      this.options.onReady();
      for (const listener of this.readyListeners) {
        listener();
      }
    }
    this.ackBootstrapWhenReady();
  }

  handleStateless(payload: string): boolean {
    try {
      return this.routeStateless(payload);
    } catch (error) {
      void createLogger('block-room').warn('Ignoring invalid collaboration message', {
        data: { error: String(error) },
      });
      return false;
    }
  }

  private routeStateless(payload: string): boolean {
    if (this.destroyed) {
      return false;
    }
    const parsed = parseServerMessage(payload);
    if (!parsed.ok) {
      void createLogger('block-room').warn('Ignoring collaboration message', { data: { ...parsed } });
      if (parsed.reason === 'invalid_shape') {
        const requests =
          parsed.kind === 'room.metadata_result'
            ? this.pending
            : parsed.kind === 'room.revision_result'
              ? this.pendingSnapshots
              : null;
        if (requests?.size) {
          for (const request of requests.values()) {
            clearTimeout(request.timeout);
            request.cleanupAbort?.();
            request.reject(new BlockRoomProtocolError('Collaboration result failed validation.', true));
          }
          requests.clear();
          this.options.onReloadRequired(undefined, 'state_mismatch');
        }
      }
      return false;
    }
    const message = parsed.message;
    switch (message.kind) {
      case 'room.reload':
        this.options.onReloadRequired(undefined, message.reloadReason);
        return true;
      case 'room.access_changed':
        this.options.onAccessChanged?.(message.access);
        return true;
      case 'room.access_ended':
        this.ready = false;
        this.destroy();
        this.options.onAccessEnded?.(message.reason);
        return true;
      case 'room.bootstrap': {
        try {
          const bootstrap = parseBlockRoomBootstrap(
            message,
            this.options.documentType,
            this.options.entityId,
            this.options.locale,
            this.options.initialSnapshot,
          );
          const validationDocument = applyBlockRoomBootstrap(bootstrap);
          try {
            this.bootstrapStateVector = Y.encodeStateVector(validationDocument);
          } finally {
            validationDocument.destroy();
          }
          this.bootstrap = bootstrap;
          this.options.onBootstrap(bootstrap);
          for (const listener of this.metadataListeners) {
            this.emitBootstrapMetadata(listener);
          }
          this.ackBootstrapWhenReady();
        } catch {
          if (message.document === undefined) {
            this.options.onOmittedBodyRejected?.();
          }
          this.options.onReloadRequired(undefined, 'state_mismatch');
        }
        return true;
      }
      case 'room.ready':
        if (!this.ackSent || !this.bootstrap || message.bootstrapChallenge !== this.bootstrap.bootstrapChallenge) {
          this.options.onReloadRequired(undefined, 'state_mismatch');
          return true;
        }
        this.ready = true;
        this.options.setResumeToken(this.bootstrap.bootstrapChallenge);
        this.options.onReady();
        for (const listener of this.readyListeners) {
          listener();
        }
        return true;
      case 'room.persisted':
        if (this.ready && message.documentName === this.bootstrap?.documentName) {
          const bytes = Uint8Array.from(atob(message.stateVector), (character) => character.charCodeAt(0));
          Y.decodeStateVector(bytes);
          for (const listener of this.persistedListeners) {
            listener({ stateVector: bytes, deleted: message.deleted });
          }
        }
        return true;
      case 'room.metadata_changed':
        if (message.documentName === this.bootstrap?.documentName) {
          this.applyMetadataAck(message.ack);
        }
        return true;
      case 'room.metadata_result': {
        const pending = this.pending.get(message.requestId);
        if (!pending) {
          return true;
        }
        this.pending.delete(message.requestId);
        clearTimeout(pending.timeout);
        pending.cleanupAbort?.();
        if (!message.ok) {
          pending.reject(
            message.error.retryable === false && !message.error.reloadReason
              ? new UnretryableSaveError(message.error.message ?? message.error.code, message.error.code)
              : new BlockRoomProtocolError(message.error.message ?? message.error.code, !!message.error.reloadReason),
          );
          if (message.error.reloadReason) {
            this.options.onReloadRequired(undefined, message.error.reloadReason);
          }
        } else {
          pending.resolve(message.ack);
          this.applyMetadataAck(message.ack);
        }
        return true;
      }
      case 'room.revision_result': {
        const pending = this.pendingSnapshots.get(message.requestId);
        if (!pending) {
          return true;
        }
        this.pendingSnapshots.delete(message.requestId);
        clearTimeout(pending.timeout);
        pending.cleanupAbort?.();
        if (!message.ok) {
          pending.reject(
            new BlockRoomProtocolError(message.error.message ?? message.error.code, !!message.error.reloadReason),
          );
          if (message.error.reloadReason) {
            this.options.onReloadRequired(undefined, message.error.reloadReason);
          }
        } else {
          const revision = message.revision;
          const bootstrap = this.bootstrap;
          const source = revision.locale === revision.sourceLocale;
          if (
            !bootstrap ||
            revision.sourceLocale !== bootstrap.sourceLocale ||
            revision.locale !== bootstrap.locale ||
            (source
              ? !revision.localeExists || revision.targetRevision !== undefined
              : revision.localeExists !== (revision.targetRevision !== undefined))
          ) {
            pending.reject(new BlockRoomProtocolError('Block-room revision failed validation.', true));
            this.options.onReloadRequired(undefined, 'state_mismatch');
          } else {
            pending.resolve(revision);
          }
        }
        return true;
      }
      default:
        return false;
    }
  }

  subscribeReady = (listener: () => void): (() => void) => {
    this.readyListeners.add(listener);
    if (this.ready) {
      listener();
    }
    return () => {
      this.readyListeners.delete(listener);
    };
  };

  subscribePersisted = (listener: (state: BlockRoomPersistedState) => void): (() => void) => {
    this.persistedListeners.add(listener);
    return () => {
      this.persistedListeners.delete(listener);
    };
  };

  get documentName(): string {
    return `${this.options.documentType}:${this.options.entityId}:${this.options.locale}`;
  }

  subscribeMetadata = (listener: (update: BlockRoomMetadataUpdate) => void): (() => void) => {
    this.metadataListeners.add(listener);
    this.emitBootstrapMetadata(listener);
    return () => {
      this.metadataListeners.delete(listener);
    };
  };

  private emitBootstrapMetadata(listener: (update: BlockRoomMetadataUpdate) => void): void {
    const bootstrap = this.bootstrap;
    if (!bootstrap) {
      return;
    }
    const { locale: _locale, ...values } = bootstrap.localeMetadata ?? bootstrap.sourceMetadata;
    listener({
      operation: 'locale',
      values: this.options.documentType === 'work' ? { ...values, sourceTitle: values.title } : values,
      sequence: bootstrap.metadataSequence,
    });
    const { documentLayout, ...documentValues } = bootstrap.documentMetadata;
    if (Object.keys(documentValues).length) {
      listener({ operation: 'document', values: documentValues, sequence: bootstrap.metadataSequence });
    }
    if (documentLayout) {
      listener({ operation: 'page_layout', values: { documentLayout }, sequence: bootstrap.metadataSequence });
    }
  }

  private applyMetadataAck(ack: BlockRoomMetadataAck): void {
    const bootstrap = this.bootstrap;
    const update = ack.metadataUpdate;
    if (!bootstrap || update.sequence <= bootstrap.metadataSequence) {
      return;
    }
    if (
      ack.locale !== bootstrap.locale ||
      (bootstrap.locale === bootstrap.sourceLocale) === Boolean(ack.targetRevision)
    ) {
      return;
    }
    const next = {
      ...bootstrap,
      documentRevision: ack.documentRevision,
      targetRevision: ack.targetRevision,
      metadataSequence: update.sequence,
    };
    if (update.operation === 'document' || update.operation === 'page_layout') {
      next.documentMetadata = { ...bootstrap.documentMetadata, ...update.values };
    }
    if (update.operation === 'locale') {
      const values = { ...bootstrap.localeMetadata };
      for (const [key, value] of Object.entries(update.values)) {
        const field = key === 'sourceTitle' ? 'title' : key;
        if (['title', 'summary', 'subject', 'creditNotes'].includes(field)) {
          (values as Record<string, unknown>)[field] = value ?? '';
        }
      }
      next.localeMetadata = { ...values, locale: bootstrap.locale };
      if (bootstrap.sourceLocale === bootstrap.locale) {
        next.sourceMetadata = next.localeMetadata;
      }
    }
    this.bootstrap = next;
    this.options.onBootstrap(next);
    for (const listener of this.metadataListeners) {
      listener(update);
    }
  }

  updateMetadata(
    operation: BlockRoomMetadataOperation,
    payload: unknown,
    signal?: AbortSignal,
  ): Promise<BlockRoomMetadataAck> {
    if (this.destroyed || !this.ready) {
      return Promise.reject(new BlockRoomProtocolError('Block-room WebSocket is not ready.'));
    }
    if (signal?.aborted) {
      return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
    }
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const pending = this.pending.get(requestId);
        if (!pending) {
          return;
        }
        this.pending.delete(requestId);
        pending.cleanupAbort?.();
        pending.reject(new BlockRoomProtocolError('Block-room metadata request timed out.', true));
        this.options.onReloadRequired();
      }, 10_000);
      const request: PendingRequest = { resolve, reject, timeout };
      if (signal) {
        const abort = () => {
          this.pending.delete(requestId);
          clearTimeout(timeout);
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        };
        signal.addEventListener('abort', abort, { once: true });
        request.cleanupAbort = () => signal.removeEventListener('abort', abort);
      }
      this.pending.set(requestId, request);
      this.options.sendStateless(
        encodeMessage({
          kind: 'room.metadata',
          requestId,
          operation,
          payload,
        }),
      );
    });
  }

  getSnapshot(signal?: AbortSignal): Promise<BlockRoomSnapshot> {
    if (this.destroyed || !this.ready) {
      return Promise.reject(new BlockRoomProtocolError('Block-room WebSocket is not ready.'));
    }
    if (signal?.aborted) {
      return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
    }
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingSnapshots.delete(requestId);
        reject(new BlockRoomProtocolError('Block-room snapshot request timed out.'));
      }, 10_000);
      const request: PendingSnapshotRequest = { resolve, reject, timeout };
      if (signal) {
        const abort = () => {
          this.pendingSnapshots.delete(requestId);
          clearTimeout(timeout);
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        };
        signal.addEventListener('abort', abort, { once: true });
        request.cleanupAbort = () => signal.removeEventListener('abort', abort);
      }
      this.pendingSnapshots.set(requestId, request);
      this.options.sendStateless(
        encodeMessage({
          kind: 'room.revision',
          requestId,
        }),
      );
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.metadataListeners.clear();
    this.persistedListeners.clear();
    this.readyListeners.clear();
    for (const request of this.pending.values()) {
      clearTimeout(request.timeout);
      request.cleanupAbort?.();
      request.reject(new BlockRoomProtocolError('Block-room WebSocket was closed.'));
    }
    this.pending.clear();
    for (const request of this.pendingSnapshots.values()) {
      clearTimeout(request.timeout);
      request.cleanupAbort?.();
      request.reject(new BlockRoomProtocolError('Block-room WebSocket was closed.'));
    }
    this.pendingSnapshots.clear();
  }

  private ackBootstrapWhenReady(): void {
    if (this.destroyed || this.ackSent || !this.providerSynced || !this.bootstrap) {
      return;
    }
    if (
      !this.bootstrapStateVector ||
      !stateVectorIncludes(Y.encodeStateVector(this.options.document), this.bootstrapStateVector)
    ) {
      this.options.onReloadRequired(undefined, 'state_mismatch');
      return;
    }
    this.ackSent = true;
    this.options.sendStateless(
      encodeMessage({
        kind: 'room.bootstrap_ack',
        challenge: this.bootstrap.bootstrapChallenge,
        stateVector: this.encodeBase64(Y.encodeStateVector(this.options.document)),
      }),
    );
  }

  private encodeBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
}
