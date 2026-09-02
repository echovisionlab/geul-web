import { Code, ConnectError } from '@connectrpc/connect';
import { AuthorizationRole } from '@echovisionlab/geul-proto/policy/access_pb.ts';
import { AccountStatus } from '@echovisionlab/geul-proto/secure/account_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSessionFromCookie } from './auth';

const mocks = vi.hoisted(() => ({
  cookieDelete: vi.fn(),
  cookieHas: vi.fn(),
  cookieSet: vi.fn(),
  cookies: vi.fn(),
  createMemberClient: vi.fn(),
  getCurrentSession: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: mocks.cookies }));

vi.mock('@/lib/api/server-client', () => ({
  createMemberClient: mocks.createMemberClient,
}));

vi.mock('@/lib/env', () => ({
  env: { HOST: 'site.example' },
  getSessionCookieName: () => 'ory_kratos_session',
}));

vi.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({
    error: mocks.loggerError,
    warn: vi.fn(),
  }),
}));

function sessionResponse(memberId = '646b433a-e294-47cf-9b40-5e368c0b0f64') {
  return {
    member: {
      summary: {
        id: memberId,
        nickname: 'Viewer Member',
        deleted: false,
      },
      email: 'viewer@example.com',
      preferredLocale: 'ko',
      role: AuthorizationRole.USER,
      status: AccountStatus.ACTIVE,
    },
    onboarded: true,
    accountIdentityId: 'b5c20411-cd95-4eb8-8ed7-bd1a0ab83c45',
  };
}

describe('getSessionFromCookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({
      has: mocks.cookieHas,
      delete: mocks.cookieDelete,
      set: mocks.cookieSet,
    });
    mocks.cookieHas.mockReturnValue(true);
    mocks.createMemberClient.mockResolvedValue({ getCurrentSession: mocks.getCurrentSession });
    mocks.getCurrentSession.mockResolvedValue(sessionResponse());
  });

  it('does not call the API when no Kratos session cookie exists', async () => {
    mocks.cookieHas.mockReturnValue(false);

    await expect(getSessionFromCookie()).resolves.toBeNull();

    expect(mocks.createMemberClient).not.toHaveBeenCalled();
  });

  it('builds the viewer from exactly one lean Member session call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(getSessionFromCookie()).resolves.toMatchObject({
      account_identity_id: 'b5c20411-cd95-4eb8-8ed7-bd1a0ab83c45',
      user: {
        id: '646b433a-e294-47cf-9b40-5e368c0b0f64',
        nickname: 'Viewer Member',
        email: 'viewer@example.com',
        preferred_locale: 'ko',
        role: 'user',
        status: 'active',
      },
      onboarded: true,
      nickname_suggestion: null,
    });

    expect(mocks.createMemberClient).toHaveBeenCalledOnce();
    expect(mocks.getCurrentSession).toHaveBeenCalledOnce();
    expect(mocks.getCurrentSession).toHaveBeenCalledWith({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the UUID placeholder internal and exposes the OIDC suggestion separately before onboarding', async () => {
    const memberId = '646b433a-e294-47cf-9b40-5e368c0b0f64';
    mocks.getCurrentSession.mockResolvedValue({
      ...sessionResponse(memberId),
      member: {
        ...sessionResponse(memberId).member,
        summary: { id: memberId, nickname: memberId, deleted: false },
      },
      onboarded: false,
      nicknameSuggestion: 'SuggestedName',
    });

    await expect(getSessionFromCookie()).resolves.toMatchObject({
      user: { id: memberId, nickname: memberId },
      onboarded: false,
      nickname_suggestion: 'SuggestedName',
    });
  });

  it('rejects a viewer that violates the non-empty Member nickname contract', async () => {
    mocks.getCurrentSession.mockResolvedValue({
      ...sessionResponse(),
      member: {
        ...sessionResponse().member,
        summary: {
          id: '646b433a-e294-47cf-9b40-5e368c0b0f64',
          nickname: '',
          deleted: false,
        },
      },
    });

    await expect(getSessionFromCookie()).resolves.toBeNull();
    expect(mocks.loggerError).toHaveBeenCalledWith('GetCurrentSession returned an invalid session projection');
  });

  it('rejects a viewer without the API-resolved account identity', async () => {
    mocks.getCurrentSession.mockResolvedValue({
      ...sessionResponse(),
      accountIdentityId: '',
    });

    await expect(getSessionFromCookie()).resolves.toBeNull();
    expect(mocks.loggerError).toHaveBeenCalledWith('GetCurrentSession returned an invalid session projection');
  });

  it('rejects an unspecified role instead of synthesizing a viewer', async () => {
    mocks.getCurrentSession.mockResolvedValue({
      ...sessionResponse(),
      member: { ...sessionResponse().member, role: AuthorizationRole.UNSPECIFIED },
    });

    await expect(getSessionFromCookie()).resolves.toBeNull();

    expect(mocks.getCurrentSession).toHaveBeenCalledOnce();
    expect(mocks.loggerError).toHaveBeenCalledWith('GetCurrentSession returned an invalid session projection');
  });

  it('clears the Kratos cookie after an unauthenticated session response', async () => {
    mocks.getCurrentSession.mockRejectedValue(new ConnectError('expired', Code.Unauthenticated));

    await expect(getSessionFromCookie()).resolves.toBeNull();

    expect(mocks.cookieDelete).toHaveBeenCalledWith('ory_kratos_session');
  });

  it('records the bounded Connect RPC code for non-authentication failures', async () => {
    const error = new ConnectError('upstream unavailable', Code.Unavailable);
    mocks.getCurrentSession.mockRejectedValue(error);

    await expect(getSessionFromCookie()).resolves.toBeNull();

    expect(mocks.loggerError).toHaveBeenCalledWith('GetCurrentSession failed', {
      error,
      data: { rpc_code: Code.Unavailable },
    });
  });
});
