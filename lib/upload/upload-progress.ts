import type { EditorRuntimeEvent } from '@echovisionlab/geul-common/collaboration/runtime-events';

export interface UploadAttemptProgress {
  identity: string;
  attemptId?: string;
  fileId?: string;
  loadedBytes: number;
  percentage: number;
}

export function mergeUploadProgress(
  current: UploadAttemptProgress,
  update: { loadedBytes?: number; percentage?: number },
) {
  if (update.loadedBytes != null && Number.isFinite(update.loadedBytes)) {
    current.loadedBytes = Math.max(current.loadedBytes, update.loadedBytes);
  }
  if (update.percentage != null && Number.isFinite(update.percentage)) {
    current.percentage = Math.max(current.percentage, Math.max(0, Math.min(100, Math.round(update.percentage))));
  }
}

export function bindUploadProgressIdentity(
  current: UploadAttemptProgress,
  identity: { attemptId?: string; fileId?: string; fallback: string },
) {
  current.attemptId = identity.attemptId || undefined;
  current.fileId = identity.fileId || undefined;
  current.identity = current.attemptId || current.fileId || identity.fallback;
}

export function resetUploadProgress(
  current: UploadAttemptProgress,
  identity: { attemptId?: string; fileId?: string; fallback: string },
) {
  bindUploadProgressIdentity(current, identity);
  current.loadedBytes = 0;
  current.percentage = 0;
}

export function runtimeEventMatchesUpload(
  current: UploadAttemptProgress,
  payload: Extract<EditorRuntimeEvent, { kind: 'file.ingest.lifecycle' }>['payload'],
) {
  const payloadAttemptId = payload.attemptId || undefined;
  const payloadFileId = payload.fileId || undefined;

  if (!payloadAttemptId && !payloadFileId) {
    return false;
  }
  if (current.attemptId && payloadAttemptId && current.attemptId !== payloadAttemptId) {
    return false;
  }
  if (current.fileId && payloadFileId && current.fileId !== payloadFileId) {
    return false;
  }

  return (
    payloadAttemptId === current.identity ||
    payloadFileId === current.identity ||
    (Boolean(payloadAttemptId) && payloadAttemptId === current.attemptId) ||
    (Boolean(payloadFileId) && payloadFileId === current.fileId)
  );
}
