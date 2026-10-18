import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAccountPersonalAccessTokenAction,
  createMyPersonalAccessTokenAction,
  deleteAccountPersonalAccessTokenAction,
  deleteMyPersonalAccessTokenAction,
  listAccountPersonalAccessTokensAction,
  listMyPersonalAccessTokensAction,
  regenerateAccountPersonalAccessTokenAction,
  regenerateMyPersonalAccessTokenAction,
} from './personal-access-token';

const mocks = vi.hoisted(() => ({
  client: {
    createAccountPersonalAccessToken: vi.fn(),
    createMyPersonalAccessToken: vi.fn(),
    deleteAccountPersonalAccessToken: vi.fn(),
    deleteMyPersonalAccessToken: vi.fn(),
    listAccountPersonalAccessTokens: vi.fn(),
    listMyPersonalAccessTokens: vi.fn(),
    regenerateAccountPersonalAccessToken: vi.fn(),
    regenerateMyPersonalAccessToken: vi.fn(),
  },
  createAccountClient: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({ createAccountClient: mocks.createAccountClient }));
vi.mock('@/lib/utils/session.server', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/utils/logger', () => ({ createLogger: () => ({ error: vi.fn() }) }));

const createdAt = timestampFromDate(new Date('2026-08-23T00:00:00.000Z'));
const token = { id: 'pat-1', createdAt };

describe('personal access token actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: 'member-1', role: 'user' } });
    mocks.createAccountClient.mockResolvedValue(mocks.client);
  });

  it('maps the Member-owned zero-or-one token contract', async () => {
    mocks.client.listMyPersonalAccessTokens.mockResolvedValue({ personalAccessTokens: [token] });

    await expect(listMyPersonalAccessTokensAction()).resolves.toEqual({
      personalAccessTokens: [{ id: 'pat-1', createdAt: '2026-08-23T00:00:00.000Z' }],
    });
    expect(mocks.client.listMyPersonalAccessTokens).toHaveBeenCalledWith({});
  });

  it('fails closed if the one-token invariant is broken', async () => {
    mocks.client.listMyPersonalAccessTokens.mockResolvedValue({
      personalAccessTokens: [token, { id: 'pat-2', createdAt }],
    });

    await expect(listMyPersonalAccessTokensAction()).resolves.toEqual({
      personalAccessTokens: [],
      error: 'invalid_response',
    });
  });

  it('creates the generic API token without a name or capability input', async () => {
    mocks.client.createMyPersonalAccessToken.mockResolvedValue({
      personalAccessToken: token,
      secret: 'one-time-secret',
    });

    await expect(createMyPersonalAccessTokenAction()).resolves.toEqual({
      personalAccessToken: { id: 'pat-1', createdAt: '2026-08-23T00:00:00.000Z' },
      secret: 'one-time-secret',
    });
    expect(mocks.client.createMyPersonalAccessToken).toHaveBeenCalledWith({});
  });

  it('maps the mutation freshness guard to reauthentication', async () => {
    mocks.client.regenerateMyPersonalAccessToken.mockRejectedValue(
      new ConnectError('Fresh browser authentication is required', Code.FailedPrecondition),
    );

    await expect(regenerateMyPersonalAccessTokenAction('pat-1')).resolves.toEqual({ error: 'reauth_required' });
  });

  it('uses the target Member RPCs for Admin management', async () => {
    mocks.client.listAccountPersonalAccessTokens.mockResolvedValue({ personalAccessTokens: [token] });
    mocks.client.createAccountPersonalAccessToken.mockResolvedValue({ personalAccessToken: token, secret: 'created' });
    mocks.client.regenerateAccountPersonalAccessToken.mockResolvedValue({
      personalAccessToken: token,
      secret: 'regenerated',
    });
    mocks.client.deleteAccountPersonalAccessToken.mockResolvedValue({ deleted: true });

    await expect(listAccountPersonalAccessTokensAction('member-2')).resolves.toMatchObject({
      personalAccessTokens: [{ id: 'pat-1' }],
    });
    await expect(createAccountPersonalAccessTokenAction('member-2')).resolves.toMatchObject({ secret: 'created' });
    await expect(regenerateAccountPersonalAccessTokenAction('member-2', 'pat-1')).resolves.toMatchObject({
      secret: 'regenerated',
    });
    await expect(deleteAccountPersonalAccessTokenAction('member-2', 'pat-1')).resolves.toEqual({ deleted: true });

    expect(mocks.client.listAccountPersonalAccessTokens).toHaveBeenCalledWith({ memberId: 'member-2' });
    expect(mocks.client.createAccountPersonalAccessToken).toHaveBeenCalledWith({ memberId: 'member-2' });
    expect(mocks.client.regenerateAccountPersonalAccessToken).toHaveBeenCalledWith({
      memberId: 'member-2',
      personalAccessTokenId: 'pat-1',
    });
    expect(mocks.client.deleteAccountPersonalAccessToken).toHaveBeenCalledWith({
      memberId: 'member-2',
      personalAccessTokenId: 'pat-1',
    });
  });

  it('rejects malformed identifiers before creating a client', async () => {
    await expect(regenerateMyPersonalAccessTokenAction('   ')).resolves.toEqual({ error: 'invalid_request' });
    await expect(deleteMyPersonalAccessTokenAction('   ')).resolves.toEqual({
      deleted: false,
      error: 'invalid_request',
    });
    await expect(createAccountPersonalAccessTokenAction('   ')).resolves.toEqual({ error: 'invalid_request' });
    expect(mocks.createAccountClient).not.toHaveBeenCalled();
  });

  it('does not call AccountService without an authenticated browser session', async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(createMyPersonalAccessTokenAction()).resolves.toEqual({ error: 'not_authenticated' });
    expect(mocks.client.createMyPersonalAccessToken).not.toHaveBeenCalled();
  });
});
