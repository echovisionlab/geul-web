import { z } from 'zod';
import {
  ClientMediaRestoreMismatchError,
  type PreparedMedia,
  checkAbort,
} from '@/lib/media/client-processing/contracts';
import type { UploadType } from '@/lib/types/upload/model';
import { prepareUploadFile } from '@/lib/utils/upload-pipeline';

const storedUploadSessionSchema = z
  .object({
    fileId: z.string().trim().min(1),
    uploadId: z.string().trim().min(1),
    attemptId: z.string().trim().min(1).optional(),
    clientMediaBundleId: z.string().trim().min(1).optional(),
  })
  .strict();

export type StoredUploadSession = z.infer<typeof storedUploadSessionSchema>;

const inMemorySessions = new Map<string, StoredUploadSession>();
const STORAGE_PREFIX = 'geul-upload-session:';

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function rememberUploadSession(session: StoredUploadSession): void {
  const parsed = storedUploadSessionSchema.parse(session);
  inMemorySessions.set(parsed.fileId, parsed);
  storage()?.setItem(`${STORAGE_PREFIX}${parsed.fileId}`, JSON.stringify(parsed));
}

export function readUploadSession(fileId: string): StoredUploadSession | null {
  const normalizedFileId = fileId.trim();
  if (!normalizedFileId) {
    return null;
  }
  const resident = inMemorySessions.get(normalizedFileId);
  if (resident) {
    return resident;
  }
  const persisted = storage()?.getItem(`${STORAGE_PREFIX}${normalizedFileId}`);
  if (!persisted) {
    return null;
  }
  try {
    const parsed = storedUploadSessionSchema.parse(JSON.parse(persisted) as unknown);
    inMemorySessions.set(parsed.fileId, parsed);
    return parsed;
  } catch {
    storage()?.removeItem(`${STORAGE_PREFIX}${normalizedFileId}`);
    return null;
  }
}

export function forgetUploadSession(fileId: string): void {
  const normalizedFileId = fileId.trim();
  if (!normalizedFileId) {
    return;
  }
  inMemorySessions.delete(normalizedFileId);
  storage()?.removeItem(`${STORAGE_PREFIX}${normalizedFileId}`);
}

export interface PreparedUploadSession {
  source: File;
  uploadType: UploadType;
  uploadId: string;
  bundleId: string;
  prepared: PreparedMedia;
  progress: { loadedBytes: number; percentage: number };
  receipts?: Array<{ path: string; sha256: string }>;
}

const preparedSessions = new Map<string, PreparedUploadSession>();

/** Keep exact prepared bytes for same-page retries; metadata alone cannot reproduce encoded output. */
export function rememberPreparedSession(fileId: string, session: PreparedUploadSession): void {
  preparedSessions.set(fileId, session);
  try {
    persistPreparedSession(fileId, session);
  } catch (error) {
    preparedSessions.delete(fileId);
    throw error;
  }
}

type SourceIdentity = Pick<File, 'name' | 'size' | 'lastModified' | 'type'>;

function matchesSession(
  session: { uploadId: string; uploadType: number; source: SourceIdentity } | null | undefined,
  uploadId: string,
  source: File,
  uploadType: UploadType,
): boolean {
  return Boolean(
    session &&
    session.uploadId === uploadId &&
    session.uploadType === uploadType &&
    session.source.name === source.name &&
    session.source.size === source.size &&
    session.source.lastModified === source.lastModified &&
    session.source.type === source.type,
  );
}

export function readPreparedSession(
  fileId: string,
  uploadId: string,
  source: File,
  uploadType: UploadType,
): PreparedUploadSession | null {
  const session = preparedSessions.get(fileId);
  return matchesSession(session, uploadId, source, uploadType) ? (session ?? null) : null;
}

export async function disposePreparedSession(fileId: string): Promise<void> {
  const session = preparedSessions.get(fileId);
  const durable = readDurablePreparedSession(fileId);
  preparedSessions.delete(fileId);
  durableStorage()?.removeItem(`${PREPARED_STORAGE_PREFIX}${fileId}`);
  if (session) {
    await session.prepared.dispose();
  } else if (durable) {
    const { disposeNamespace } = await import('@/lib/media/client-processing/artifact-storage');
    await disposeNamespace(durable.storageId);
  }
}

const PREPARED_STORAGE_PREFIX = 'geul-prepared-upload:';
const durablePreparedUploadSchema = z
  .object({
    storageId: z.string().min(1),
    sourceFingerprint: z.string().min(1),
    uploadId: z.string().min(1),
    bundleId: z.string().min(1),
    uploadType: z.number().int(),
    source: z
      .object({ name: z.string(), size: z.number().nonnegative(), lastModified: z.number(), type: z.string() })
      .strict(),
    progress: z.object({ loadedBytes: z.number().nonnegative(), percentage: z.number().min(0).max(99) }).strict(),
    receipts: z.array(z.object({ path: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()),
  })
  .strict();

function durableStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readDurablePreparedSession(fileId: string) {
  const serialized = durableStorage()?.getItem(`${PREPARED_STORAGE_PREFIX}${fileId}`);
  if (!serialized) {
    return null;
  }
  try {
    return durablePreparedUploadSchema.parse(JSON.parse(serialized));
  } catch {
    durableStorage()?.removeItem(`${PREPARED_STORAGE_PREFIX}${fileId}`);
    return null;
  }
}

function persistPreparedSession(fileId: string, session: PreparedUploadSession): void {
  const { storageId, sourceFingerprint } = session.prepared;
  if (!storageId || !sourceFingerprint) {
    return;
  }
  const index = durablePreparedUploadSchema.parse({
    storageId,
    sourceFingerprint,
    uploadId: session.uploadId,
    bundleId: session.bundleId,
    uploadType: session.uploadType,
    source: {
      name: session.source.name,
      size: session.source.size,
      lastModified: session.source.lastModified,
      type: session.source.type,
    },
    progress: { loadedBytes: session.progress.loadedBytes, percentage: Math.min(99, session.progress.percentage) },
    receipts: session.receipts ?? [],
  });
  durableStorage()?.setItem(`${PREPARED_STORAGE_PREFIX}${fileId}`, JSON.stringify(index));
}

export function updatePreparedProgress(fileId: string, progress: PreparedUploadSession['progress']): void {
  const session = preparedSessions.get(fileId);
  if (!session) {
    return;
  }
  session.progress = progress;
  const durable = readDurablePreparedSession(fileId);
  // Persist at most once per whole percentage point; receipts are persisted immediately below.
  if (!durable || durable.progress.percentage !== Math.min(99, progress.percentage)) {
    persistPreparedSession(fileId, session);
  }
}

export function rememberArtifactReceipt(fileId: string, receipt: { path: string; sha256: string }): void {
  const session = preparedSessions.get(fileId);
  if (
    !session ||
    !session.prepared.artifacts.some((artifact) => artifact.path === receipt.path && artifact.sha256 === receipt.sha256)
  ) {
    return;
  }
  session.receipts = [...(session.receipts ?? []).filter(({ path }) => path !== receipt.path), receipt];
  persistPreparedSession(fileId, session);
}

export function clearArtifactReceipts(fileId: string): void {
  const session = preparedSessions.get(fileId);
  if (!session) {
    return;
  }
  session.receipts = [];
  persistPreparedSession(fileId, session);
}

export async function restorePreparedSession(
  fileId: string,
  uploadId: string,
  source: File,
  uploadType: UploadType,
  options: { signal: AbortSignal; onProgress?: (progress: number) => void },
): Promise<PreparedUploadSession | null> {
  const resident = readPreparedSession(fileId, uploadId, source, uploadType);
  if (resident) {
    return resident;
  }
  const durable = readDurablePreparedSession(fileId);
  if (!durable || !matchesSession(durable, uploadId, source, uploadType)) {
    return null;
  }
  checkAbort(options.signal);
  const { file: canonicalSource } = await prepareUploadFile(source, uploadType);
  checkAbort(options.signal);
  const { restoreMedia } = await import('@/lib/media/client-processing/processor');
  checkAbort(options.signal);
  const prepared = await restoreMedia(durable.storageId, canonicalSource, options);
  if (!prepared) {
    return null;
  }
  if (prepared.sourceFingerprint !== durable.sourceFingerprint) {
    throw new ClientMediaRestoreMismatchError('Prepared media fingerprint changed. Select the original source file.');
  }
  const session: PreparedUploadSession = {
    source,
    uploadType,
    uploadId,
    bundleId: durable.bundleId,
    prepared,
    progress: durable.progress,
    receipts: durable.receipts.filter((receipt) =>
      prepared.artifacts.some((artifact) => artifact.path === receipt.path && artifact.sha256 === receipt.sha256),
    ),
  };
  preparedSessions.set(fileId, session);
  return session;
}
