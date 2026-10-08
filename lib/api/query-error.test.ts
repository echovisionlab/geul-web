import { Code, ConnectError } from '@connectrpc/connect';
import { createReactServerErrorHandler } from 'next/dist/server/app-render/create-error-handler';
import { describe, expect, it, vi } from 'vitest';
import { resolveErrorStatus } from '@/features/application-error/error-status';
import { throwQueryError } from './query-error';

describe('production Server Component error boundary', () => {
  it.each([
    [Code.Unauthenticated, 401],
    [Code.PermissionDenied, 403],
    [Code.InvalidArgument, 400],
    [Code.ResourceExhausted, 429],
    [Code.Unavailable, 503],
    [Code.DeadlineExceeded, 504],
    [Code.Internal, 500],
  ])('preserves %s as %s after Next removes the original message and properties', (code, status) => {
    const error = new ConnectError('private SQL diagnostics', code);
    try {
      throwQueryError(error);
    } catch (failure) {
      const handler = createReactServerErrorHandler(false, false, new Map(), vi.fn());
      const digest = handler(failure);
      expect(digest).not.toContain('private');
      const transported = { message: 'An error occurred in the Server Components render.', digest };
      expect(resolveErrorStatus(transported)).toBe(status);
    }
  });
  it('keeps unknown failures at 500 and ignores malformed digests', () => {
    expect(resolveErrorStatus({ digest: 'geul-query:503:private' })).toBe(500);
    expect(resolveErrorStatus({ digest: 'unrelated:403' })).toBe(500);
  });
});
