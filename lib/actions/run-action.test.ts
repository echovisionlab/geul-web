import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runAction } from './run-action';

const logServerFailure = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error;
    }
  },
}));
vi.mock('@/lib/logging/logger', () => ({ logServerFailure }));

beforeEach(() => logServerFailure.mockReset());

describe('runAction', () => {
  it('returns the success fields with ok', async () => {
    await expect(
      runAction('work-actions', 'save', async () => ({ success: true as const }), { fallback: 'x' }),
    ).resolves.toEqual({
      ok: true,
      success: true,
    });
    expect(logServerFailure).not.toHaveBeenCalled();
  });

  it('logs once and keeps the Connect code with the chosen message', async () => {
    const denied = new ConnectError('nope', Code.PermissionDenied);
    const result = await runAction(
      'work-actions',
      'save',
      async () => {
        throw denied;
      },
      {
        fallback: 'Failed to save',
        messages: { [Code.PermissionDenied]: 'No permission' },
        privateValues: ['a@b.test'],
      },
    );
    expect(result).toEqual({ ok: false, error: 'No permission', errorCode: Code.PermissionDenied });
    expect(logServerFailure).toHaveBeenCalledWith('work-actions', 'save', denied, ['a@b.test']);
  });

  it('uses the server message without the code prefix, then the fallback', async () => {
    const fail = (error: unknown) =>
      runAction(
        's',
        'o',
        async () => {
          throw error;
        },
        { fallback: 'Failed', code: 'POST_UPDATE_FAILED' },
      );
    await expect(fail(new ConnectError('slug taken', Code.AlreadyExists))).resolves.toMatchObject({
      error: 'slug taken',
      errorCode: Code.AlreadyExists,
    });
    await expect(fail(new ConnectError('', Code.Internal))).resolves.toMatchObject({ error: 'Failed' });
    await expect(fail(new ConnectError('ended', Code.Unauthenticated))).resolves.toMatchObject({
      error: 'Unauthorized',
      errorCode: Code.Unauthenticated,
    });
    await expect(fail('boom')).resolves.toMatchObject({ error: 'Failed', errorCode: 'POST_UPDATE_FAILED' });
    await expect(fail(new Error(''))).resolves.toMatchObject({ error: 'Failed' });
  });

  it('lets redirect and notFound through as navigation', async () => {
    const redirect = new Error('NEXT_REDIRECT');
    await expect(
      runAction(
        's',
        'o',
        async () => {
          throw redirect;
        },
        { fallback: 'x' },
      ),
    ).rejects.toBe(redirect);
    expect(logServerFailure).not.toHaveBeenCalled();
  });
});
