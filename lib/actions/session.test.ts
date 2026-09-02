import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listSessionsAction, revokeOtherSessionsAction, revokeSessionAction } from './session';

const mocks = vi.hoisted(() => ({
  createAccountClient: vi.fn(),
  getMySecurity: vi.fn(),
  getSession: vi.fn(),
  loggerError: vi.fn(),
  revokeMyOtherSessions: vi.fn(),
  revokeMySession: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createAccountClient: mocks.createAccountClient,
}));

vi.mock('@/lib/utils/session.server', () => ({
  getSession: mocks.getSession,
}));

vi.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({ error: mocks.loggerError }),
}));

const currentSession = {
  user: { id: 'member-1' },
};

describe('Account session actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue(currentSession);
    mocks.createAccountClient.mockResolvedValue({
      getMySecurity: mocks.getMySecurity,
      revokeMySession: mocks.revokeMySession,
      revokeMyOtherSessions: mocks.revokeMyOtherSessions,
    });
    mocks.getMySecurity.mockResolvedValue({
      security: {
        sessions: [
          {
            id: 'session-current',
            current: true,
            active: true,
            authenticatedAt: timestampFromDate(new Date('2026-08-01T00:00:00.000Z')),
          },
          {
            id: 'session-other',
            current: false,
            active: true,
          },
        ],
      },
    });
  });

  it('loads the Account-owned session projection including the current marker', async () => {
    await expect(listSessionsAction()).resolves.toEqual([
      {
        id: 'session-current',
        active: true,
        current: true,
        authenticated_at: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 'session-other',
        active: true,
        current: false,
        authenticated_at: '',
      },
    ]);

    expect(mocks.getMySecurity).toHaveBeenCalledWith({});
  });

  it('revokes one non-current session through AccountService', async () => {
    await expect(revokeSessionAction('session-other')).resolves.toEqual({});

    expect(mocks.revokeMySession).toHaveBeenCalledWith({ sessionId: 'session-other' });
  });

  it('revokes every other session through the aggregate Account command', async () => {
    await expect(revokeOtherSessionsAction()).resolves.toEqual({});

    expect(mocks.revokeMyOtherSessions).toHaveBeenCalledWith({});
  });

  it('does not create an Account client without an authenticated Member viewer', async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(listSessionsAction()).resolves.toEqual([]);
    await expect(revokeSessionAction('session-other')).resolves.toEqual({
      error: 'Unauthorized',
      errorCode: 'UNAUTHORIZED',
    });
    await expect(revokeOtherSessionsAction()).resolves.toEqual({
      error: 'Unauthorized',
      errorCode: 'UNAUTHORIZED',
    });

    expect(mocks.createAccountClient).not.toHaveBeenCalled();
  });

  it('maps Account authorization errors without calling Kratos Admin from Web', async () => {
    mocks.revokeMySession.mockRejectedValue(new ConnectError('session cannot be revoked', Code.PermissionDenied));

    await expect(revokeSessionAction('session-current')).resolves.toEqual({
      error: '[permission_denied] session cannot be revoked',
      errorCode: 'UNAUTHORIZED',
    });
  });
});
