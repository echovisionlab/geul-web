import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cookies } from 'next/headers';
import { GET, POST } from './route';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getSessionCookieName: vi.fn(() => 'site_session'),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  getSessionCookieName: mocks.getSessionCookieName,
  getKratosUrl: () => 'http://kratos.internal',
}));

vi.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
  }),
}));

vi.mock('@/lib/utils/url.server', () => ({
  getCanonicalUrl: () => 'https://studio.example.com',
}));

function setRequestCookies(values = [{ name: 'site_session', value: 'session-value' }]) {
  vi.mocked(cookies).mockResolvedValue({
    getAll: () => values,
  } as Awaited<ReturnType<typeof cookies>>);
}

function setCookieHeaders(response: Response) {
  return response.headers.getSetCookie();
}

beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.getSessionCookieName.mockReturnValue('site_session');
  mocks.loggerError.mockReset().mockResolvedValue(undefined);
  mocks.loggerWarn.mockReset().mockResolvedValue(undefined);
  setRequestCookies();
  vi.stubGlobal('fetch', mocks.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auth logout route', () => {
  it('redirects through the Kratos logout URL without exposing the session cookie', async () => {
    mocks.fetch.mockResolvedValue(
      Response.json({ logout_url: 'http://kratos.internal/self-service/logout?token=logout-token' }),
    );

    const response = await GET();

    expect(mocks.fetch).toHaveBeenCalledWith('http://kratos.internal/self-service/logout/browser', {
      headers: { Cookie: 'site_session=session-value' },
      cache: 'no-store',
    });
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://studio.example.com/api/auth/self-service/logout?token=logout-token',
    );
    expect(setCookieHeaders(response)).toEqual(expect.arrayContaining([expect.stringContaining('geul_user_display=')]));
    expect(mocks.loggerWarn).not.toHaveBeenCalled();
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it('uses the canonical public origin and expires local session cookies when Kratos rejects the session', async () => {
    mocks.fetch.mockResolvedValue(new Response(null, { status: 401 }));

    const response = await GET();
    const responseCookies = setCookieHeaders(response);

    expect(response.headers.get('location')).toBe('https://studio.example.com/');
    expect(responseCookies).toEqual(expect.arrayContaining([expect.stringContaining('geul_user_display=')]));
    expect(responseCookies).toEqual(expect.arrayContaining([expect.stringContaining('site_session=')]));
    expect(responseCookies.join('\n')).toContain('Domain=.example.com');
    expect(responseCookies.join('\n')).not.toContain('0.0.0.0');
    expect(mocks.loggerWarn).toHaveBeenCalledWith('Kratos logout URL request failed', {
      data: { status: 401 },
    });
  });

  it('logs and safely logs out locally when Kratos omits logout_url', async () => {
    mocks.fetch.mockResolvedValue(Response.json({}));

    const response = await GET();

    expect(response.headers.get('location')).toBe('https://studio.example.com/');
    expect(mocks.loggerWarn).toHaveBeenCalledWith('Kratos logout URL response was missing or untrusted');
  });

  it.each([
    'https://evil.example/self-service/logout?token=logout-token',
    'https://user:secret@identity.example.com/self-service/logout?token=logout-token',
    'https://identity.example.com/self-service/login?token=logout-token',
    'https://identity.example.com/self-service/logout?token=logout-token&return_to=https://evil.example',
    'https://identity.example.com/self-service/logout?token=logout-token#fragment',
  ])('rejects an untrusted logout URL %s', async (logoutUrl) => {
    mocks.fetch.mockResolvedValue(Response.json({ logout_url: logoutUrl }));

    const response = await GET();

    expect(response.headers.get('location')).toBe('https://studio.example.com/');
    expect(mocks.loggerWarn).toHaveBeenCalledWith('Kratos logout URL response was missing or untrusted');
  });

  it('logs and safely logs out locally when the Kratos request throws', async () => {
    const error = new Error('connection failed');
    mocks.fetch.mockRejectedValue(error);

    const response = await GET();

    expect(response.headers.get('location')).toBe('https://studio.example.com/');
    expect(mocks.loggerError).toHaveBeenCalledWith('Kratos logout URL request threw', { error });
  });

  it('supports POST with the same logout behavior', async () => {
    mocks.fetch.mockResolvedValue(new Response(null, { status: 401 }));

    const response = await POST();

    expect(response.headers.get('location')).toBe('https://studio.example.com/');
  });

  it('expires the canonical __Host session without a Domain attribute', async () => {
    mocks.getSessionCookieName.mockReturnValue('__Host-test-session');
    setRequestCookies([{ name: '__Host-test-session', value: 'session-value' }]);
    mocks.fetch.mockResolvedValue(new Response(null, { status: 401 }));

    const response = await GET();
    const canonicalDeletion = setCookieHeaders(response).find((value) => value.startsWith('__Host-test-session='));

    expect(canonicalDeletion).toBeDefined();
    expect(canonicalDeletion).toContain('Path=/');
    expect(canonicalDeletion).toContain('Secure');
    expect(canonicalDeletion).not.toContain('Domain=');
  });
});
