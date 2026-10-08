import { Code, ConnectError } from '@connectrpc/connect';
import { describe, expect, it } from 'vitest';
import { toHttpErrorResult } from './http-error';
import { isAuthenticationConnectError } from './connect-error';

describe('HTTP error classification', () => {
  it.each([
    [Code.Canceled, 499],
    [Code.InvalidArgument, 400],
    [Code.OutOfRange, 400],
    [Code.Unauthenticated, 401],
    [Code.PermissionDenied, 403],
    [Code.NotFound, 404],
    [Code.AlreadyExists, 409],
    [Code.Aborted, 409],
    [Code.FailedPrecondition, 422],
    [Code.ResourceExhausted, 429],
    [Code.Unimplemented, 501],
    [Code.Unavailable, 503],
    [Code.DeadlineExceeded, 504],
    [Code.Internal, 500],
    [Code.Unknown, 500],
    [Code.DataLoss, 500],
  ])('keeps code %s at HTTP %s without leaking details', (code, status) => {
    const result = toHttpErrorResult(new ConnectError('private SQL/provider credential', code), 'Request failed');
    expect(result.status).toBe(status);
    expect(result.error).not.toContain('private');
  });
  it('does not mistake authentication dependency failures for anonymous users', () => {
    for (const code of [Code.Internal, Code.Unavailable, Code.DeadlineExceeded, Code.Unknown]) {
      expect(
        isAuthenticationConnectError(new ConnectError('authentication unavailable; login backend failed', code)),
      ).toBe(false);
    }
  });
});
