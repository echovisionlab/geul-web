import { describe, expect, it } from 'vitest';
import { appendExpiredSessionCookies, buildCookieHeader, getSessionCookieNames } from './session-cookie';

describe('session-cookie helpers', () => {
  it('uses only the configured session cookie name', () => {
    expect(getSessionCookieNames('__Host-test-session')).toEqual(['__Host-test-session']);
  });

  it('builds cookie headers from cookie objects', () => {
    expect(
      buildCookieHeader([
        { name: 'theme', value: 'dark' },
        { name: '__Host-test-session', value: 'abc' },
      ]),
    ).toBe('theme=dark; __Host-test-session=abc');
  });

  it('expires the __Host session cookie only as a secure host-only cookie', () => {
    const headers = new Headers();
    appendExpiredSessionCookies(headers, {
      requestUrl: 'https://www.example.invalid/my/security',
      sessionCookieNames: ['__Host-test-session'],
    });

    const setCookie = headers.getSetCookie();
    expect(setCookie).toHaveLength(1);
    expect(setCookie[0]).toContain('__Host-test-session=');
    expect(setCookie[0]).toContain('Path=/');
    expect(setCookie[0]).toContain('Secure');
    expect(setCookie[0]).not.toContain('Domain=');
  });
});
