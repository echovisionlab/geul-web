import { Code } from '@connectrpc/connect';
import type { ActionResult } from '@/lib/actions/action-result';
import {
  UPLOAD_ABORTED_MESSAGE,
  UPLOAD_FAILED_MESSAGE,
  UPLOAD_FINALIZATION_FAILED_MESSAGE,
  UPLOAD_INTERRUPTED_MESSAGE,
} from '@/lib/upload/failure';

type UploadPartError = Error & { status?: number; retryable?: boolean; retryAfterMs?: number };

export function normalizeUploadErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '');
  if (message === UPLOAD_ABORTED_MESSAGE) {
    return UPLOAD_ABORTED_MESSAGE;
  }

  const normalized = message.toLowerCase();
  if (
    normalized.includes('failed to read upload part body') ||
    normalized.includes('i/o timeout') ||
    normalized.includes('unexpected eof') ||
    normalized.includes('networkerror') ||
    normalized.includes('network error') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('fetch failed') ||
    normalized === 'load failed' ||
    normalized.includes('body stream') ||
    normalized.includes('context canceled') ||
    normalized.includes('upload interrupted')
  ) {
    return UPLOAD_INTERRUPTED_MESSAGE;
  }
  if (normalized.includes('failed to upload part')) {
    return UPLOAD_FAILED_MESSAGE;
  }
  if (normalized.includes('failed to complete multipart upload')) {
    return UPLOAD_FINALIZATION_FAILED_MESSAGE;
  }
  return message || UPLOAD_FAILED_MESSAGE;
}

export function createUploadError(error: unknown): Error {
  return new Error(normalizeUploadErrorMessage(error));
}

export function createTerminalUploadCompletionError(error: unknown): Error {
  const normalized = createUploadError(error);
  return normalized.message === UPLOAD_FINALIZATION_FAILED_MESSAGE
    ? createUploadError(UPLOAD_FAILED_MESSAGE)
    : normalized;
}

export function isDefinitiveUploadCompletionError(error: unknown): boolean {
  const message = createUploadError(error).message;
  return message === UPLOAD_FAILED_MESSAGE || message === 'Unauthorized' || message === 'Forbidden';
}

export function createUploadPartError(
  status: number,
  detail: string,
  retryable = false,
  retryAfter?: string | null,
): UploadPartError {
  const error = createUploadError(`Failed to upload part: ${detail}`) as UploadPartError;
  error.status = status;
  error.retryable = retryable;
  if ((status === 429 || status === 503) && retryAfter) {
    const seconds = Number(retryAfter);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(delay)) {
      error.retryAfterMs = Math.max(0, Math.min(delay, 60_000));
    }
  }
  return error;
}

export function isRetryableUploadPartError(error: unknown): boolean {
  const uploadError = error as UploadPartError;
  const message = normalizeUploadErrorMessage(error);
  if (message === UPLOAD_ABORTED_MESSAGE) {
    return false;
  }
  if (uploadError.status != null) {
    return (
      uploadError.retryable === true ||
      uploadError.status === 408 ||
      uploadError.status === 429 ||
      uploadError.status >= 500
    );
  }
  return message === UPLOAD_INTERRUPTED_MESSAGE || message === UPLOAD_FAILED_MESSAGE;
}

export const CLIENT_MEDIA_ARTIFACTS_MISSING = 'CLIENT_MEDIA_ARTIFACTS_MISSING';

export function isClientMediaArtifactsMissingError(error: unknown): boolean {
  return error instanceof Error && error.message === CLIENT_MEDIA_ARTIFACTS_MISSING;
}

/** Turns a client media commit result into the completion value, or the error the completion policy classifies. */
export function unwrapClientMediaCompletion(result: ActionResult<{ url: string; fileId: string }>): {
  url: string;
  fileId: string;
} {
  if (result.ok) {
    return { url: result.url, fileId: result.fileId };
  }
  if (result.error === CLIENT_MEDIA_ARTIFACTS_MISSING) {
    throw new Error(CLIENT_MEDIA_ARTIFACTS_MISSING);
  }
  if (result.errorCode === Code.Unauthenticated) {
    throw new Error('Unauthorized');
  }
  if (result.errorCode === Code.PermissionDenied) {
    throw new Error('Forbidden');
  }
  if (
    [Code.InvalidArgument, Code.NotFound, Code.FailedPrecondition, Code.DataLoss].includes(result.errorCode as Code)
  ) {
    throw new Error('Upload failed');
  }
  throw new Error(result.error);
}

export function isClientMediaRestoreMismatchError(
  error: unknown,
): error is Error & { code: 'CLIENT_MEDIA_RESTORE_MISMATCH' } {
  return error instanceof Error && 'code' in error && error.code === 'CLIENT_MEDIA_RESTORE_MISMATCH';
}
