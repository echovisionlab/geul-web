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

  it('returns an unauthenticated result without calling the account service', async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(getConnectedProvidersAction()).resolves.toMatchObject({ error: 'Not authenticated' });
    expect(mocks.createAccountClient).not.toHaveBeenCalled();
  });
});
