import { z } from 'zod';
import * as Y from 'yjs';
import {
  applyBlockRoomBootstrap,
  parseBlockRoomBootstrap,
  targetRevisionSchema,
  type BlockRoomBootstrap,
  type BlockRoomDocumentType,
} from '@/lib/collab/block-room-bootstrap';

const metadataAckSchema = z
  .object({
    documentRevision: z.string().uuid(),
    targetRevision: targetRevisionSchema.optional(),
    changed: z.boolean(),
    sourceChanged: z.boolean(),
    changedLocales: z.array(z.string()),
    locale: z.string().trim().min(1),
  })
  .strict();

const readySchema = z
  .object({
    kind: z.literal('block_room.ready'),
    protocolVersion: z.literal(1),
    bootstrapChallenge: z.string().trim().min(1),
  })
  .strict();

const metadataResultSchema = z
  .object({
    kind: z.literal('block_room.metadata_result'),
    protocolVersion: z.literal(1),
    requestId: z.string().uuid(),
    ok: z.boolean(),
    ack: z.unknown().optional(),
    error: z.string().optional(),
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
    protocolVersion: z.literal(1),
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
  private readonly pending = new Map<string, PendingRequest>();
  private readonly pendingSnapshots = new Map<string, PendingSnapshotRequest>();

  constructor(private readonly options: BlockRoomProtocolClientOptions) {}

  handleProviderSynced(): void {
    this.providerSynced = true;
    if (this.ready) {
      this.options.onReady();
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
    pending.resolve(ack.data);
    return true;
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
          protocolVersion: 1,
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
          protocolVersion: 1,
          requestId,
        }),
      );
    });
  }

  destroy(): void {
    this.destroyed = true;
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
        protocolVersion: 1,
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
