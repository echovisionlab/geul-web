import { toHttpErrorResult } from './http-error';

const DIGEST_PREFIX = 'geul-query:';

/** Only a status and random identifier cross Next's production RSC error boundary. */
export function markQueryError(error: Error, status: number): Error {
  return Object.assign(error, { digest: `${DIGEST_PREFIX}${status}:${crypto.randomUUID()}` });
}

export function preservedQueryErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('digest' in error) || typeof error.digest !== 'string') {
    return undefined;
  }
  const match = /^geul-query:([45]\d{2}):[0-9a-f-]{36}$/.exec(error.digest);
  return match ? Number(match[1]) : undefined;
}

export function throwQueryError(error: unknown): never {
  const { status } = toHttpErrorResult(error, 'Failed to load data');
  const failure = error instanceof Error ? error : new Error('Failed to load data', { cause: error });
  throw markQueryError(failure, status);
}
