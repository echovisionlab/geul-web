import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearInvalidSessionCookie } from './invalid-session-cookie';

const { cookieSet, envState } = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  envState: { name: '__Host-session', host: 'www.rawsector.com' },
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ set: cookieSet }) }));
vi.mock('@/lib/env', () => ({
  env: {
    get HOST() {
      return envState.host;
    },
  },
  getSessionCookieName: () => envState.name,
}));
vi.mock('@/lib/utils/logger', () => ({ createLogger: () => ({ warn: vi.fn() }) }));

beforeEach(() => cookieSet.mockReset());

describe('clearInvalidSessionCookie', () => {
  it('expires a __Host- cookie with Secure and Path=/ and no Domain, the only form browsers accept', async () => {
    envState.name = '__Host-session';
    await clearInvalidSessionCookie();
    expect(cookieSet).toHaveBeenCalledOnce();
    expect(cookieSet).toHaveBeenCalledWith('__Host-session', '', {
      path: '/',
      expires: new Date(0),
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
    });
  });

  it('expires other cookies on the parent domain, or host-only for local hosts', async () => {
    envState.name = 'ory_kratos_session';
    envState.host = 'www.rawsector.com';
    await clearInvalidSessionCookie();
    expect(cookieSet).toHaveBeenCalledWith('ory_kratos_session', '', {
      domain: '.rawsector.com',
      path: '/',
      expires: new Date(0),
    });

    cookieSet.mockReset();
    envState.host = 'localhost:3000';
    await clearInvalidSessionCookie();
    expect(cookieSet).toHaveBeenCalledWith('ory_kratos_session', '', { path: '/', expires: new Date(0) });
  });
});
