import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestEmailChangeAction } from './email';

const mocks = vi.hoisted(() => ({
  createAccountClient: vi.fn(),
}));

const accountClient = vi.hoisted(() => ({
  requestEmailChange: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createAccountClient: mocks.createAccountClient,
}));

describe('email actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAccountClient.mockResolvedValue(accountClient);
  });

  it('requests email changes through the user service', async () => {
    accountClient.requestEmailChange.mockResolvedValueOnce({
      success: true,
      message: 'Verification email sent',
    });

    await expect(requestEmailChangeAction('new@example.test')).resolves.toEqual({
      success: true,
      message: 'Verification email sent',
    });

    expect(accountClient.requestEmailChange).toHaveBeenCalledWith({
      newEmail: 'new@example.test',
    });
  });

  it('returns connect errors without throwing', async () => {
    accountClient.requestEmailChange.mockRejectedValueOnce(
      new ConnectError('email already exists', Code.AlreadyExists),
    );

    await expect(requestEmailChangeAction('taken@example.test')).resolves.toEqual({
      success: false,
      message: '[already_exists] email already exists',
    });
  });

  it('maps the email preflight freshness guard to reauthentication', async () => {
    accountClient.requestEmailChange.mockRejectedValueOnce(
      new ConnectError('reauthenticate before changing sign-in methods', Code.FailedPrecondition),
    );

    await expect(requestEmailChangeAction('new@example.test')).resolves.toMatchObject({
      success: false,
      error: 'reauth_required',
    });
  });

  it('returns default request failures for unknown errors', async () => {
    accountClient.requestEmailChange.mockRejectedValueOnce('transport closed');

    await expect(requestEmailChangeAction('retry@example.test')).resolves.toEqual({
      success: false,
      message: 'Failed to request email change',
    });
  });
});
