import { z } from 'zod';

const storedUploadSessionSchema = z
  .object({
    fileId: z.string().trim().min(1),
    uploadId: z.string().trim().min(1),
    attemptId: z.string().trim().min(1).optional(),
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
