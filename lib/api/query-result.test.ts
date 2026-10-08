import { Code, ConnectError } from '@connectrpc/connect';
import { describe, expect, it } from 'vitest';
import { queryResult, unwrapQueryResult } from './query-result';
import { resolveErrorStatus } from '@/features/application-error/error-status';

describe('Server Action query failures', () => {
  it.each([
    [Code.Unauthenticated, 401],
    [Code.PermissionDenied, 403],
    [Code.InvalidArgument, 400],
    [Code.NotFound, 404],
    [Code.ResourceExhausted, 429],
    [Code.Unavailable, 503],
    [Code.DeadlineExceeded, 504],
    [Code.Internal, 500],
  ])('preserves code %s across JSON serialization as status %s', async (code, status) => {
    const result = await queryResult(async () => {
      throw new ConnectError('private SQL diagnostics', code);
    });
    const transported = JSON.parse(JSON.stringify(result));
    expect(transported).toMatchObject({ ok: false, status });
    expect(await queryResult(async () => unwrapQueryResult(transported))).toMatchObject({ ok: false, status });
    expect(JSON.stringify(transported)).not.toContain('private');
    try {
      unwrapQueryResult(transported);
      expect.fail('Failure must not become an empty successful list');
    } catch (error) {
      expect(resolveErrorStatus(error)).toBe(status);
    }
  });
  it('preserves a genuinely empty successful list', async () => {
    expect(unwrapQueryResult(await queryResult(async () => []))).toEqual([]);
  });
});
