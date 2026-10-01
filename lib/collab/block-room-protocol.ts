import { z } from 'zod';
import * as Y from 'yjs';
import {
  applyBlockRoomBootstrap,
  parseBlockRoomBootstrap,
  targetRevisionSchema,
  type BlockRoomBootstrap,
  type BlockRoomDocumentType,
} from '@/lib/collab/block-room-bootstrap';

const metadataUpdateSchema = z
  .object({
    operation: z.enum(['locale', 'document', 'page_layout']),
    values: z.record(z.string(), z.unknown()),
    sequence: z.number().int().positive(),
  })
  .strict();

const metadataAckSchema = z
  .object({
    documentRevision: z.string().uuid(),
    targetRevision: targetRevisionSchema.optional(),
    changed: z.boolean(),
    sourceChanged: z.boolean(),
    changedLocales: z.array(z.string()),
    locale: z.string().trim().min(1),
    metadataUpdate: metadataUpdateSchema,
  })
  .strict();

const persistedSchema = z
  .object({
    kind: z.literal('block_room.persisted'),
    protocolVersion: z.literal(2),
    documentName: z.string().min(1),
    stateVector: z.string().min(1),
    deleted: z.record(
      z.string().regex(/^\d+$/u),
      z.array(z.object({ clock: z.number().int().nonnegative(), len: z.number().int().positive() }).strict()),
    ),
  })
  .strict();

export interface BlockRoomPersistedState {
  stateVector: Uint8Array;
  deleted: Record<string, Array<{ clock: number; len: number }>>;
}

const readySchema = z
  .object({
    kind: z.literal('block_room.ready'),
    protocolVersion: z.literal(2),
    bootstrapChallenge: z.string().trim().min(1),
  })
  .strict();

const metadataResultSchema = z
  .object({
    kind: z.literal('block_room.metadata_result'),
    protocolVersion: z.literal(2),
    requestId: z.string().uuid(),
    ok: z.boolean(),
    ack: z.unknown().optional(),
    error: z.string().optional(),
  })
  .strict();

const metadataChangedSchema = z
  .object({
    kind: z.literal('block_room.metadata_changed'),
    protocolVersion: z.literal(2),
    documentName: z.string().min(1),
    ack: metadataAckSchema,
  })
  .strict();

const snapshotSchema = z
  .object({
    documentRevision: z.string().uuid(),
    targetRevision: targetRevisionSchema.optional(),
    sourceLocale: z.string().trim().min(1),
    locale: z.string().trim().min(1),
    localeExists: z.boolean(),
  })
  .strict();

const snapshotResultSchema = z
  .object({
    kind: z.literal('block_room.snapshot_result'),
    protocolVersion: z.literal(2),
    requestId: z.string().uuid(),
    ok: z.boolean(),
    snapshot: z.unknown().optional(),
    error: z.string().optional(),
  })
  .strict();

const reloadSchema = z
  .object({
    kind: z.literal('reload_required'),
    reason: z.literal('reload_required'),
  })
  .strict();

export type BlockRoomMetadataUpdate = z.infer<typeof metadataUpdateSchema>;
export type BlockRoomMetadataAck = z.infer<typeof metadataAckSchema>;
export interface BlockRoomSnapshot {
  documentRevision: string;
  targetRevision?: string;
  sourceLocale: string;
  locale: string;
  localeExists: boolean;
}
export type BlockRoomMetadataOperation = 'locale' | 'document' | 'page_layout';

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
  onReloadRequired: () => void;
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

function parseJson(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return undefined;
  }
}

export class BlockRoomProtocolClient implements BlockRoomProtocolTransport {
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
    const raw = parseJson(payload);
    if (reloadSchema.safeParse(raw).success) {
      this.options.onReloadRequired();
      return true;
    }
    if (raw && typeof raw === 'object' && (raw as { kind?: unknown }).kind === 'block_room.bootstrap') {
      try {
        const bootstrap = parseBlockRoomBootstrap(
          raw,
          this.options.documentType,
          this.options.entityId,
          this.options.locale,
        );
        const validationDocument = applyBlockRoomBootstrap(bootstrap);
        validationDocument.destroy();
        this.bootstrap = bootstrap;
        this.options.onBootstrap(bootstrap);
        for (const listener of this.metadataListeners) {
          this.emitBootstrapMetadata(listener);
        }
        this.ackBootstrapWhenReady();
      } catch {
        this.options.onReloadRequired();
      }
      return true;
    }
    const ready = readySchema.safeParse(raw);
    if (ready.success) {
      if (!this.ackSent || !this.bootstrap || ready.data.bootstrapChallenge !== this.bootstrap.bootstrapChallenge) {
        this.options.onReloadRequired();
        return true;
      }
      this.ready = true;
      this.options.setResumeToken(this.bootstrap.bootstrapChallenge);
      this.options.onReady();
      for (const listener of this.readyListeners) {
        listener();
      }
      return true;
    }
    const persisted = persistedSchema.safeParse(raw);
    if (persisted.success) {
      if (this.ready && persisted.data.documentName === this.bootstrap?.documentName) {
        try {
          const bytes = Uint8Array.from(atob(persisted.data.stateVector), (character) => character.charCodeAt(0));
          Y.decodeStateVector(bytes);
          for (const listener of this.persistedListeners) {
            listener({ stateVector: bytes, deleted: persisted.data.deleted });
          }
        } catch {
          /* Ignore malformed durability hints; they must never acknowledge local edits. */
        }
      }
      return true;
    }
    const metadataChanged = metadataChangedSchema.safeParse(raw);
    if (metadataChanged.success) {
      if (metadataChanged.data.documentName === this.bootstrap?.documentName) {
        this.applyMetadataAck(metadataChanged.data.ack);
      }
      return true;
    }
    const result = metadataResultSchema.safeParse(raw);
    if (!result.success) {
      const snapshotResult = snapshotResultSchema.safeParse(raw);
      if (!snapshotResult.success) {
        return false;
      }
      const pendingSnapshot = this.pendingSnapshots.get(snapshotResult.data.requestId);
      if (!pendingSnapshot) {
        return true;
      }
      this.pendingSnapshots.delete(snapshotResult.data.requestId);
      clearTimeout(pendingSnapshot.timeout);
      pendingSnapshot.cleanupAbort?.();
      if (!snapshotResult.data.ok) {
        pendingSnapshot.reject(
          new BlockRoomProtocolError(
            `Block-room snapshot failed: ${snapshotResult.data.error ?? 'unknown_error'}.`,
            snapshotResult.data.error === 'reload_required',
          ),
        );
        if (snapshotResult.data.error === 'reload_required') {
          this.options.onReloadRequired();
        }
      } else {
        const snapshot = snapshotSchema.safeParse(snapshotResult.data.snapshot);
        const bootstrap = this.bootstrap;
        if (!snapshot.success || !bootstrap) {
          pendingSnapshot.reject(new BlockRoomProtocolError('Block-room snapshot failed validation.', true));
          this.options.onReloadRequired();
        } else {
          const isExactRoom =
            snapshot.data.sourceLocale === bootstrap.sourceLocale && snapshot.data.locale === bootstrap.locale;
          const isSourceRoom = snapshot.data.locale === snapshot.data.sourceLocale;
          const hasRevisionParity = isSourceRoom
            ? snapshot.data.localeExists && snapshot.data.targetRevision === undefined
            : snapshot.data.localeExists === (snapshot.data.targetRevision !== undefined);
          if (!isExactRoom || !hasRevisionParity) {
            pendingSnapshot.reject(new BlockRoomProtocolError('Block-room snapshot failed validation.', true));
            this.options.onReloadRequired();
          } else {
            pendingSnapshot.resolve(snapshot.data);
          }
        }
      }
      return true;
    }
    const pending = this.pending.get(result.data.requestId);
    if (!pending) {
      return true;
    }
    this.pending.delete(result.data.requestId);
    clearTimeout(pending.timeout);
    pending.cleanupAbort?.();
    if (!result.data.ok) {
      pending.reject(
        new BlockRoomProtocolError(
          `Block-room metadata failed: ${result.data.error ?? 'unknown_error'}.`,
          result.data.error === 'reload_required',
        ),
      );
      if (result.data.error === 'reload_required') {
        this.options.onReloadRequired();
      }
      return true;
    }
    const ack = metadataAckSchema.safeParse(result.data.ack);
    if (!ack.success) {
      pending.reject(new BlockRoomProtocolError('Block-room metadata ACK failed validation.', true));
      this.options.onReloadRequired();
      return true;
    }
    this.applyMetadataAck(ack.data);
    pending.resolve(ack.data);
    return true;
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
        JSON.stringify({
          kind: 'block_room.metadata',
          protocolVersion: 2,
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
        JSON.stringify({
          kind: 'block_room.snapshot',
          protocolVersion: 2,
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
    const expected = new Y.Doc();
    try {
      Y.applyUpdate(expected, this.bootstrap.yjsBootstrapUpdate);
      if (!stateVectorIncludes(Y.encodeStateVector(this.options.document), Y.encodeStateVector(expected))) {
        this.options.onReloadRequired();
        return;
      }
    } finally {
      expected.destroy();
    }
    this.ackSent = true;
    this.options.sendStateless(
      JSON.stringify({
        kind: 'block_room.bootstrap_ack',
        protocolVersion: 2,
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
