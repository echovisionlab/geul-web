import {
  UPLOAD_ABORTED_MESSAGE,
  UPLOAD_FAILED_MESSAGE,
  UPLOAD_FINALIZATION_FAILED_MESSAGE,
  UPLOAD_INTERRUPTED_MESSAGE,
} from '@/lib/upload/failure';

type UploadPartError = Error & { status?: number; retryable?: boolean };

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

export function createUploadPartError(status: number, detail: string, retryable = false): UploadPartError {
  const error = createUploadError(`Failed to upload part: ${detail}`) as UploadPartError;
  error.status = status;
  error.retryable = retryable;
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
