import type { Code } from '@connectrpc/connect';

/**
 * The structural test `ConnectError[Symbol.hasInstance]` applies, without importing `ConnectError`.
 * Error boundaries run on every route; `ConnectError` brings the protobuf binary runtime with it
 * (about 10 kB gzip of shared first-load JS). `connect-error-shape.test.ts` keeps the two equal.
 */
export function connectErrorShapeCode(error: unknown): Code | undefined {
  if (
    error instanceof Error &&
    error.name === 'ConnectError' &&
    'code' in error &&
    typeof error.code === 'number' &&
    'metadata' in error &&
    'details' in error &&
    Array.isArray(error.details) &&
    'rawMessage' in error &&
    typeof error.rawMessage === 'string' &&
    'cause' in error
  ) {
    return error.code as Code;
  }
  return undefined;
}
