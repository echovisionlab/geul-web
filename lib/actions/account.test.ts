import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestAccountDeletionAction } from './account';

const mocks = vi.hoisted(() => ({
  createAccountClient: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createAccountClient: mocks.createAccountClient,
  createPublicAccountClient: vi.fn(),
}));

describe('account actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps the account-deletion freshness guard to reauthentication', async () => {
    mocks.createAccountClient.mockResolvedValue({
      requestAccountDeletion: vi
        .fn()
        .mockRejectedValue(new ConnectError('reauthenticate before changing sign-in methods', Code.FailedPrecondition)),
    });

    await expect(requestAccountDeletionAction()).resolves.toMatchObject({
      success: false,
      error: 'reauth_required',
    });
  });
});
