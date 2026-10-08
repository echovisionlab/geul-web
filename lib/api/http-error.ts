import { Code } from '@connectrpc/connect';
import { connectErrorCode } from './connect-error';

const HTTP_ERRORS: Partial<Record<Code, { status: number; error: string }>> = {
  [Code.Canceled]: { status: 499, error: 'Request canceled' },
  [Code.InvalidArgument]: { status: 400, error: 'Invalid request' },
  [Code.OutOfRange]: { status: 400, error: 'Invalid request' },
  [Code.Unauthenticated]: { status: 401, error: 'Unauthorized' },
  [Code.PermissionDenied]: { status: 403, error: 'Forbidden' },
  [Code.NotFound]: { status: 404, error: 'Not found' },
  [Code.AlreadyExists]: { status: 409, error: 'Conflict' },
  [Code.Aborted]: { status: 409, error: 'Conflict' },
  [Code.FailedPrecondition]: { status: 422, error: 'Request precondition failed' },
  [Code.ResourceExhausted]: { status: 429, error: 'Too many requests' },
  [Code.Unimplemented]: { status: 501, error: 'Not implemented' },
  [Code.Unavailable]: { status: 503, error: 'Service temporarily unavailable' },
  [Code.DeadlineExceeded]: { status: 504, error: 'Upstream request timed out' },
};

/** Preserve known failure categories without exposing upstream diagnostics. */
export function toHttpErrorResult(error: unknown, fallback: string): { status: number; error: string } {
  const code = connectErrorCode(error);
  const classified = code === undefined ? undefined : HTTP_ERRORS[code];
  return classified ? { ...classified } : { status: 500, error: fallback };
}
