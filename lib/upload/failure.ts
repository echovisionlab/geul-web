export const UPLOAD_ABORTED_MESSAGE = 'Upload aborted';
export const UPLOAD_INTERRUPTED_MESSAGE = 'Upload interrupted';
export const UPLOAD_FAILED_MESSAGE = 'Upload failed';
export const UPLOAD_FINALIZATION_FAILED_MESSAGE = 'Upload finalization failed';

export const UploadFailureCode = {
  ABORTED: 'U-CANCELLED',
  INTERRUPTED_RECOVERABLE: 'U-INTERRUPTED-RECOVERABLE',
  INTERRUPTED_TERMINAL: 'U-INTERRUPTED-TERMINAL',
  FAILED_RECOVERABLE: 'U-FAILED-RECOVERABLE',
  FAILED_TERMINAL: 'U-FAILED-TERMINAL',
} as const;

export type UploadFailureCode = (typeof UploadFailureCode)[keyof typeof UploadFailureCode];

export interface UploadFailureSessionState {
  resumable?: boolean;
}

export function resolveUploadFailureCode(
  message: string,
  session?: UploadFailureSessionState | null,
): UploadFailureCode {
  if (message === UPLOAD_ABORTED_MESSAGE) {
    return UploadFailureCode.ABORTED;
  }

  const hasRecoverableSession = Boolean(session?.resumable);

  if (message === UPLOAD_INTERRUPTED_MESSAGE) {
    return hasRecoverableSession ? UploadFailureCode.INTERRUPTED_RECOVERABLE : UploadFailureCode.INTERRUPTED_TERMINAL;
  }

  if (message === UPLOAD_FAILED_MESSAGE) {
    return hasRecoverableSession ? UploadFailureCode.FAILED_RECOVERABLE : UploadFailureCode.FAILED_TERMINAL;
  }

  if (message === UPLOAD_FINALIZATION_FAILED_MESSAGE) {
    return session ? UploadFailureCode.FAILED_RECOVERABLE : UploadFailureCode.FAILED_TERMINAL;
  }

  return UploadFailureCode.FAILED_TERMINAL;
}

export function isRecoverableUploadFailure(code: UploadFailureCode): boolean {
  return code === UploadFailureCode.INTERRUPTED_RECOVERABLE || code === UploadFailureCode.FAILED_RECOVERABLE;
}
