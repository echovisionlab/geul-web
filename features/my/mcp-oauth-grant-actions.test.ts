import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listMyMcpOAuthGrants, revokeMyMcpOAuthGrant } from './mcp-oauth-grant-actions';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  list: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromCookie: mocks.getSession }));
vi.mock('@/features/auth/hydra-mcp-oauth', () => ({
  listMcpOAuthGrants: mocks.list,
  revokeMcpOAuthGrant: mocks.revoke,
}));

const session = {
  account_identity_id: 'b5c20411-cd95-4eb8-8ed7-bd1a0ab83c45',
  user: { role: 'author' },
};

describe('MCP OAuth grant settings actions', () => {
  beforeEach(() => {
    mocks.getSession.mockReset().mockResolvedValue(session);
    mocks.list
      .mockReset()
      .mockResolvedValue([{ id: 'grant-1', clientName: 'Codex', connectedAt: '2026-08-28T09:00:00Z' }]);
    mocks.revoke.mockReset().mockResolvedValue(undefined);
  });

  it('lists grants only through the current Author session', async () => {
    await expect(listMyMcpOAuthGrants()).resolves.toEqual({
      grants: [{ id: 'grant-1', clientName: 'Codex', connectedAt: '2026-08-28T09:00:00Z' }],
    });
    expect(mocks.list).toHaveBeenCalledWith(session);
  });

  it('rejects ordinary Users before Hydra access', async () => {
    mocks.getSession.mockResolvedValue({ ...session, user: { role: 'user' } });
    await expect(listMyMcpOAuthGrants()).resolves.toEqual({ grants: [], error: 'not_authorized' });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('rechecks the current session when revoking', async () => {
    await expect(revokeMyMcpOAuthGrant('grant-1')).resolves.toEqual({ success: true });
    expect(mocks.revoke).toHaveBeenCalledWith(session, 'grant-1');
  });
});
