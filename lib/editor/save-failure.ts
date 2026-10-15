import { Code } from '@connectrpc/connect';

/**
 * A save the server refused for good: repeating the same request cannot succeed (permission,
 * validation, a deleted entity). Save queues stop retrying it and keep it as a recoverable backup
 * the editor can review, copy or discard (Notion's retryable:false and Local Backups).
 */
export class UnretryableSaveError extends Error {
  constructor(
    message: string,
    /** Stable reason code, e.g. a Connect code name or a collaboration protocol error code. */
    readonly reason: string,
  ) {
    super(message);
    this.name = 'UnretryableSaveError';
  }
}

/** Connect codes that describe the request itself, not a transient condition. */
const UNRETRYABLE_CODES: ReadonlySet<Code> = new Set([
  Code.InvalidArgument,
  Code.NotFound,
  Code.AlreadyExists,
  Code.PermissionDenied,
  Code.OutOfRange,
  Code.Unimplemented,
]);

export function isUnretryableErrorCode(code: unknown): code is Code {
  return typeof code === 'number' && UNRETRYABLE_CODES.has(code as Code);
}

export function isUnretryableSaveFailure(error: unknown): error is UnretryableSaveError {
  return error instanceof UnretryableSaveError;
}

/** The error a save writer throws for a failed server action result. */
export function saveFailureFromAction(result: { error: string; errorCode?: unknown }): Error {
  return isUnretryableErrorCode(result.errorCode)
    ? new UnretryableSaveError(result.error, Code[result.errorCode])
    : new Error(result.error);
}

/**
 * The room is read-only (downgraded to view): the save is not attempted. Save queues keep the
 * fields and their recovery backup, send nothing and stop retrying; a page reopened with edit
 * access restores and saves them.
 */
export class SaveParkedError extends Error {
  constructor() {
    super('The room is read-only; the save waits for edit access.');
    this.name = 'SaveParkedError';
  }
}
