// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

const SCRIPT_SCHEME_URL = ['java', 'script:alert(1)'].join('');

describe('login-redirect helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('builds a refresh login browser URL with a return target', async () => {
    vi.stubGlobal('document', {
      documentElement: {
        dataset: {
          geulCdnUrl: 'https://cdn.example.test',
          geulApiUrl: 'https://api.example.test',
        },
      },
    });
    vi.stubGlobal('window', {});

    const { buildLoginBrowserUrl } = await import('./login-redirect');
    expect(
      buildLoginBrowserUrl({
        refresh: true,
        returnTo: '/my/security?reauth=passkey',
      }),
    ).toBe('/api/auth/login?refresh=true&return_to=%2Fmy%2Fsecurity%3Freauth%3Dpasskey');
  });

  it('stores and consumes auth redirects exactly once', async () => {
    const storage = new Map<string, string>();
    const storageLike = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };

    const { AUTH_REDIRECT_STORAGE_KEY, consumeAuthRedirect, rememberAuthRedirect } = await import('./login-redirect');

    rememberAuthRedirect('/my/security?reauth=passkey', storageLike);
    expect(storage.get(AUTH_REDIRECT_STORAGE_KEY)).toBe('/my/security?reauth=passkey');
    expect(consumeAuthRedirect(storageLike)).toBe('/my/security?reauth=passkey');
    expect(storage.has(AUTH_REDIRECT_STORAGE_KEY)).toBe(false);
  });

  it('continues without a stored redirect when browser storage is unavailable', async () => {
    const unavailableStorage = {
      getItem: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
      removeItem: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
    };
    const { consumeAuthRedirect, rememberAuthRedirect } = await import('./login-redirect');

    expect(() => rememberAuthRedirect('/my/security', unavailableStorage)).not.toThrow();
    expect(consumeAuthRedirect(unavailableStorage)).toBeNull();
  });

  it('prefers a valid stored redirect, then the identity return target and page redirect', async () => {
    const { resolveLoginSuccessRedirect } = await import('./login-redirect');

    expect(
      resolveLoginSuccessRedirect({
        storedRedirect: '/stored',
        flowReturnTo: 'https://sso.example/login?login_challenge=abc',
        redirectUrl: '/fallback',
        origin: 'https://studio.example.com',
      }),
    ).toBe('/stored');

    expect(
      resolveLoginSuccessRedirect({
        storedRedirect: '/stored',
        flowReturnTo: null,
        redirectUrl: '/fallback',
        origin: 'https://studio.example.com',
      }),
    ).toBe('/stored');

    expect(
      resolveLoginSuccessRedirect({
        storedRedirect: null,
        flowReturnTo: 'https://sso.example/login?login_challenge=abc',
        redirectUrl: '/fallback',
        origin: 'https://studio.example.com',
      }),
    ).toBe('https://sso.example/login?login_challenge=abc');

    expect(
      resolveLoginSuccessRedirect({
        storedRedirect: null,
        flowReturnTo: null,
        redirectUrl: '/fallback',
        origin: 'https://studio.example.com',
      }),
    ).toBe('/fallback');
  });

  it.each([
    ['https://evil.example/phish', '/'],
    ['//evil.example/phish', '/'],
    [SCRIPT_SCHEME_URL, '/'],
    ['https://user:password@studio.example.com/private', '/'],
    ['not a valid url\u0000', '/'],
  ])('rejects an unsafe page redirect %s', async (redirectUrl, expected) => {
    const { resolveLoginSuccessRedirect } = await import('./login-redirect');

    expect(
      resolveLoginSuccessRedirect({
        redirectUrl,
        origin: 'https://studio.example.com',
      }),
    ).toBe(expected);
  });

  it('ignores unsafe stale storage and continues to an allowlisted identity return target', async () => {
    const { resolveLoginSuccessRedirect } = await import('./login-redirect');

    expect(
      resolveLoginSuccessRedirect({
        storedRedirect: 'https://evil.example/from-storage',
        flowReturnTo: 'https://sso.example/login?login_challenge=abc',
        redirectUrl: '/fallback',
        origin: 'https://studio.example.com',
      }),
    ).toBe('https://sso.example/login?login_challenge=abc');
  });

  it.each([SCRIPT_SCHEME_URL, '//evil.example/phish', 'https://user:password@sso.example/login'])(
    'rejects an invalid identity return target %s',
    async (flowReturnTo) => {
      const { resolveLoginSuccessRedirect } = await import('./login-redirect');

      expect(
        resolveLoginSuccessRedirect({
          flowReturnTo,
          redirectUrl: '/fallback',
          origin: 'https://studio.example.com',
        }),
      ).toBe('/fallback');
    },
  );

  it('uses a validated identity return target across auth-flow switches', async () => {
    const { resolveAuthFlowContinuation } = await import('./login-redirect');

    expect(
      resolveAuthFlowContinuation({
        flowReturnTo: 'https://sso.example/login?login_challenge=abc',
        redirectUrl: '/fallback',
        origin: 'https://studio.example.com',
      }),
    ).toBe('https://sso.example/login?login_challenge=abc');
  });

  it('round-trips only the exact same-origin newsletter continuation and its safe final redirect', async () => {
    const { buildNewsletterAuthContinuation, resolveNewsletterAuthContinuation } = await import('./login-redirect');
    const origin = 'https://studio.example.com';
    const continuation = buildNewsletterAuthContinuation('/after-auth?source=footer', origin);

    expect(continuation).toBe('/login?intent=newsletter&redirect=%2Fafter-auth%3Fsource%3Dfooter');
    expect(resolveNewsletterAuthContinuation(new URL(continuation, origin).toString(), origin)).toEqual({
      redirectUrl: '/after-auth?source=footer',
    });
  });

  it('accepts newsletter intent only from an exact direct entry without a flow', async () => {
    const { resolveDirectNewsletterEntry } = await import('./login-redirect');
    const origin = 'https://studio.example.com';

    expect(resolveDirectNewsletterEntry('intent=newsletter', origin)).toEqual({ redirectUrl: '/' });
    expect(resolveDirectNewsletterEntry('intent=newsletter&redirect=%2Fafter-auth', origin)).toEqual({
      redirectUrl: '/after-auth',
    });
  });

  it.each([
    'flow=flow-1&intent=newsletter&redirect=%2Fafter-auth',
    'intent=newsletter&intent=newsletter&redirect=%2Fafter-auth',
    'intent=newsletter&redirect=%2Ffirst&redirect=%2Fsecond',
    'intent=newsletter&redirect=%2Fafter-auth&unexpected=true',
    'intent=newsletter&redirect=https%3A%2F%2Fevil.example%2Fphish',
  ])('rejects an injected or duplicate direct newsletter query: %s', async (query) => {
    const { resolveDirectNewsletterEntry } = await import('./login-redirect');

    expect(resolveDirectNewsletterEntry(query, 'https://studio.example.com')).toBeNull();
  });

  it('binds the purpose continuation to one flow lifecycle and rejects a different flow', async () => {
    const storage = new Map<string, string>();
    const storageLike = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };
    const { claimNewsletterAuthContinuation, rememberNewsletterAuthContinuation } = await import('./login-redirect');
    const origin = 'https://studio.example.com';
    const continuation = '/login?intent=newsletter&redirect=%2Fafter-auth';

    rememberNewsletterAuthContinuation(continuation, origin, null, storageLike);
    expect(claimNewsletterAuthContinuation('flow-1', origin, storageLike)).toEqual({ redirectUrl: '/after-auth' });
    expect(claimNewsletterAuthContinuation('flow-2', origin, storageLike)).toBeNull();
    expect(storage.size).toBe(0);
  });

  it.each([
    '/login?redirect=%2Fafter-auth',
    '/login?intent=newsletter&redirect=%2Fafter-auth&unexpected=true',
    '/login?intent=newsletter&intent=newsletter&redirect=%2Fafter-auth',
    'https://evil.example/login?intent=newsletter&redirect=%2Fafter-auth',
    '/login?intent=newsletter&redirect=https%3A%2F%2Fevil.example%2Fphish',
  ])('does not treat an ordinary or untrusted continuation as newsletter intent: %s', async (continuation) => {
    const { resolveNewsletterAuthContinuation } = await import('./login-redirect');

    expect(resolveNewsletterAuthContinuation(continuation, 'https://studio.example.com')).toBeNull();
  });

  it('resolves direct login redirects to same-origin absolute return_to URLs', async () => {
    const { resolveSameOriginLoginReturnTo } = await import('./login-redirect');

    expect(resolveSameOriginLoginReturnTo('/admin', 'https://studio.example.com')).toBe(
      'https://studio.example.com/admin',
    );
    expect(resolveSameOriginLoginReturnTo('/admin?tab=users', 'https://studio.example.com')).toBe(
      'https://studio.example.com/admin?tab=users',
    );
    expect(resolveSameOriginLoginReturnTo('https://evil.example/phish', 'https://studio.example.com')).toBe(
      'https://studio.example.com/',
    );
    expect(resolveSameOriginLoginReturnTo('//evil.example/phish', 'https://studio.example.com')).toBe(
      'https://studio.example.com/',
    );
    expect(
      resolveSameOriginLoginReturnTo('https://user:secret@studio.example.com/private', 'https://studio.example.com'),
    ).toBe('https://studio.example.com/');
  });

  it('starts privileged reauthentication with refresh=true and stores the return target', async () => {
    const redirects: string[] = [];
    const storage = new Map<string, string>();
    const storageLike = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };

    const { AUTH_REDIRECT_STORAGE_KEY, startPrivilegedReauthentication } = await import('./login-redirect');

    startPrivilegedReauthentication('/my/security?reauth=passkey', {
      assign: (url) => redirects.push(url),
      origin: 'https://studio.example.com',
      storage: storageLike,
    });

    expect(storage.get(AUTH_REDIRECT_STORAGE_KEY)).toBe('/my/security?reauth=passkey');
    expect(redirects).toEqual(['/api/auth/login?refresh=true&return_to=%2Fmy%2Fsecurity%3Freauth%3Dpasskey']);
  });

  it.each([
    'https://evil.example/private',
    '//evil.example/private',
    SCRIPT_SCHEME_URL,
    'https://user:secret@studio.example.com/private',
  ])('rejects an unsafe privileged reauthentication target %s', async (returnTo) => {
    const redirects: string[] = [];
    const storage = new Map<string, string>();
    const storageLike = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };
    const { AUTH_REDIRECT_STORAGE_KEY, startPrivilegedReauthentication } = await import('./login-redirect');

    startPrivilegedReauthentication(returnTo, {
      assign: (url) => redirects.push(url),
      origin: 'https://studio.example.com',
      storage: storageLike,
    });

    expect(storage.has(AUTH_REDIRECT_STORAGE_KEY)).toBe(false);
    expect(redirects).toEqual(['/api/auth/login?refresh=true&return_to=%2F']);
  });
});
