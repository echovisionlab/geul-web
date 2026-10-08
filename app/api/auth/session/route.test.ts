import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSessionFromCookie: mocks.session }));
beforeEach(() => vi.resetAllMocks());
describe('session HTTP boundary', () => {
  it('clears display state only for an invalid or absent session', async () => {
    mocks.session.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeTruthy();
  });
  it.each([
    [Code.Unavailable, 503],
    [Code.DeadlineExceeded, 504],
    [Code.Internal, 500],
  ])('keeps the cookie on dependency failures', async (code, status) => {
    mocks.session.mockRejectedValue(new ConnectError('private auth details', code));
    const response = await GET();
    expect(response.status).toBe(status);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.text()).not.toContain('private');
    expect(mocks.session).toHaveBeenCalledWith({ throwOnError: true });
  });
});
