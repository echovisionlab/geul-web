import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getConnectedProvidersAction } from './identity';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  createAccountClient: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({ createAccountClient: mocks.createAccountClient }));
vi.mock('@/lib/utils/session.server', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/utils/logger', () => ({ createLogger: () => ({ error: vi.fn() }) }));

describe('identity actions', () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.createAccountClient.mockReset();
  });

  it('loads the single canonical email and connected providers from the backend API', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.createAccountClient.mockResolvedValue({
      getMySecurity: vi.fn().mockResolvedValue({
        security: {
          canonicalEmail: 'user@example.com',
          emailCodeAvailable: true,
          providers: [{ provider: 'google', identifier: 'google-subject' }],
          emailCandidates: [],
          sessions: [],
          passkeyCount: 0,
        },
      }),
    });

    await expect(getConnectedProvidersAction()).resolves.toMatchObject({
      canonicalEmail: 'user@example.com',
      emailCodeAvailable: true,
      providers: [{ provider: 'google', identifier: 'google-subject' }],
    });
  });

  it('returns an unauthenticated result without calling the account service', async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(getConnectedProvidersAction()).resolves.toMatchObject({ error: 'Not authenticated' });
    expect(mocks.createAccountClient).not.toHaveBeenCalled();
  });
});
