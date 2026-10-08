import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), client: vi.fn() }));
vi.mock('@/lib/api/server-client', () => ({ createMemberClient: mocks.client }));
vi.mock('@/lib/utils/logger', () => ({ createLogger: () => ({ error: vi.fn() }) }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockResolvedValue({ getMySettings: mocks.get, updateMyPreferences: mocks.update });
});

describe('cookie consent HTTP boundary', () => {
  it.each([null, [], 3, 'text', {}, { analytics: 'yes' }])(
    'rejects invalid body %j without calling API',
    async (payload) => {
      const response = await POST(
        new Request('https://www.dsub.io/api/cookie-consent', { method: 'POST', body: JSON.stringify(payload) }),
      );
      expect(response.status).toBe(400);
      expect(mocks.client).not.toHaveBeenCalled();
    },
  );
  it.each([
    Code.InvalidArgument,
    Code.PermissionDenied,
    Code.NotFound,
    Code.ResourceExhausted,
    Code.Unavailable,
    Code.DeadlineExceeded,
    Code.Internal,
  ])('classifies upstream error %s for both methods', async (code) => {
    const statuses: Partial<Record<Code, number>> = {
      [Code.InvalidArgument]: 400,
      [Code.PermissionDenied]: 403,
      [Code.NotFound]: 404,
      [Code.ResourceExhausted]: 429,
      [Code.Unavailable]: 503,
      [Code.DeadlineExceeded]: 504,
      [Code.Internal]: 500,
    };
    mocks.get.mockRejectedValue(new ConnectError('private authentication SQL detail', code));
    mocks.update.mockRejectedValue(new ConnectError('private authentication SQL detail', code));
    for (const response of [
      await GET(),
      await POST(
        new Request('https://www.dsub.io/api/cookie-consent', {
          method: 'POST',
          body: JSON.stringify({ analytics: true }),
        }),
      ),
    ]) {
      expect(response.status).toBe(statuses[code]);
      expect(await response.text()).not.toContain('private');
    }
  });
  it('keeps anonymous consent browser-only', async () => {
    mocks.get.mockRejectedValue(new ConnectError('sign in', Code.Unauthenticated));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ persisted: false });
  });
});
