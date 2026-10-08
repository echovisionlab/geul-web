import { Code, ConnectError } from '@connectrpc/connect';
import { describe, expect, it } from 'vitest';
import { canRetryErrorStatus, getErrorPageContent, resolveErrorStatus } from './error-status';

describe('application error classification', () => {
  it.each([
    [Code.InvalidArgument, 400],
    [Code.Unauthenticated, 401],
    [Code.PermissionDenied, 403],
    [Code.NotFound, 404],
    [Code.AlreadyExists, 409],
    [Code.Aborted, 409],
    [Code.FailedPrecondition, 422],
    [Code.ResourceExhausted, 429],
    [Code.Unavailable, 503],
    [Code.DeadlineExceeded, 504],
    [Code.Internal, 500],
  ])('maps RPC code %s to HTTP status %s', (code, status) => {
    expect(resolveErrorStatus(new ConnectError('private backend detail', code))).toBe(status);
  });

  it('uses explicit HTTP statuses and defaults unknown failures to 500', () => {
    expect(resolveErrorStatus(Object.assign(new Error('failed'), { status: 502 }))).toBe(502);
    expect(resolveErrorStatus(Object.assign(new Error('failed'), { statusCode: 429 }))).toBe(429);
    for (const status of [200, 399, 600, 500.5, NaN, '403']) {
      expect(resolveErrorStatus({ status })).toBe(500);
    }
    expect(resolveErrorStatus(new Error('403 is only part of this message'))).toBe(500);
    expect(resolveErrorStatus(null)).toBe(500);
  });

  it('keeps an unfamiliar valid error code with a safe localized title', () => {
    expect(getErrorPageContent(418, 'ko')).toMatchObject({ code: '418', title: '문제가 발생했습니다' });
  });

  it('offers retry only for transient failures', () => {
    expect([400, 401, 403, 404, 409, 410, 413, 422].some(canRetryErrorStatus)).toBe(false);
    expect([408, 429, 500, 502, 503, 504].every(canRetryErrorStatus)).toBe(true);
  });
});
