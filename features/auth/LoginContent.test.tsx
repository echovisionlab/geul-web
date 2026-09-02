// @vitest-environment jsdom

import { act } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import enMessages from '@/messages/en.json';
import { LoginContent } from './LoginContent';
import { LoginController } from './LoginController';
import { rememberNewsletterAuthContinuation } from './login-redirect';
import type { UnifiedLoginTransport } from './unified-login-transport';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const navigationMock = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
  },
  searchParams: new URLSearchParams('flow=flow-1'),
}));

const authMock = vi.hoisted(() => ({
  session: null as unknown,
  newsletterSubscription: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigationMock.router,
  useSearchParams: () => navigationMock.searchParams,
}));

vi.mock('@/lib/auth/client', () => ({
  useSession: () => ({ data: authMock.session, isPending: false }),
}));

vi.mock('@/lib/actions/newsletter', () => ({
  setCurrentUserNewsletterSubscriptionAction: (...args: unknown[]) => authMock.newsletterSubscription(...args),
}));

vi.mock('@/lib/public-runtime-config', () => ({
  getPublicAuthUrl: () => '/api/auth',
  getPublicAuthCodeLifespanSeconds: () => 900,
  getPublicAuthCodeResendCooldownSeconds: () => 60,
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;

const codeFlow = {
  id: 'flow-1',
  expires_at: '2099-07-31T12:30:00.000Z',
  return_to: '/after-login',
  ui: {
    nodes: [
      {
        type: 'input',
        group: 'default',
        attributes: {
          name: 'csrf_token',
          type: 'hidden',
          value: 'csrf-token',
        },
      },
      {
        type: 'input',
        group: 'default',
        attributes: {
          name: 'identifier',
          type: 'hidden',
          value: 'johndoe@example.com',
        },
      },
      {
        type: 'input',
        group: 'code',
        attributes: {
          name: 'method',
          type: 'hidden',
          value: 'code',
        },
      },
      {
        type: 'input',
        group: 'code',
        attributes: {
          name: 'code',
          type: 'text',
          value: '',
        },
      },
      {
        type: 'input',
        group: 'code',
        attributes: {
          name: 'resend',
          type: 'submit',
          value: 'code',
        },
      },
    ],
    messages: [],
  },
};

const passkeyFlow = {
  id: 'flow-1',
  return_to: '/after-login',
  ui: {
    nodes: [
      {
        type: 'input',
        group: 'default',
        attributes: { name: 'csrf_token', type: 'hidden', value: 'csrf-token' },
      },
      {
        type: 'input',
        group: 'default',
        attributes: {
          name: 'identifier',
          type: 'text',
          value: '',
          autocomplete: 'username webauthn',
        },
      },
      {
        type: 'input',
        group: 'passkey',
        attributes: {
          name: 'passkey_login_trigger',
          type: 'button',
          onclickTrigger: 'oryPasskeyLogin',
        },
      },
      {
        type: 'input',
        group: 'passkey',
        attributes: { name: 'passkey_challenge', type: 'hidden', value: '{}' },
      },
      {
        type: 'input',
        group: 'passkey',
        attributes: { name: 'passkey_login', type: 'hidden', value: '' },
      },
      {
        type: 'input',
        group: 'code',
        attributes: { name: 'method', type: 'submit', value: 'code' },
      },
      {
        type: 'input',
        group: 'oidc',
        attributes: { name: 'provider', type: 'submit', value: 'google' },
      },
      {
        type: 'input',
        group: 'oidc',
        attributes: { name: 'provider', type: 'submit', value: 'github' },
      },
      {
        type: 'script',
        group: 'passkey',
        attributes: {
          id: 'webauthn_script',
          src: '/api/auth/.well-known/ory/webauthn.js',
        },
      },
    ],
    messages: [],
  },
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let credentialsDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  navigationMock.router.push.mockReset();
  navigationMock.router.replace.mockReset();
  navigationMock.searchParams = new URLSearchParams('flow=flow-1');
  authMock.session = null;
  authMock.newsletterSubscription.mockReset();
  window.sessionStorage.clear();
  credentialsDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'credentials');
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  delete (window as unknown as Record<string, unknown>).__oryWebAuthnInitialized;
  delete (window as unknown as Record<string, unknown>).oryPasskeyLogin;
  if (credentialsDescriptor) {
    Object.defineProperty(window.navigator, 'credentials', credentialsDescriptor);
  } else {
    Reflect.deleteProperty(window.navigator, 'credentials');
  }
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('LoginContent', () => {
  it('explains that a privileged refresh will automatically continue the security request', async () => {
    const refreshFlow = {
      ...codeFlow,
      refresh: true,
      return_to: '/my/security?resume_account_security_action=1',
    };
    const transport: UnifiedLoginTransport = {
      actionUrl: vi.fn(() => '/api/auth/login?flow=flow-1'),
      browserUrl: vi.fn(() => '/api/auth/login'),
      load: vi.fn().mockResolvedValue({ kind: 'continued', flow: refreshFlow, ok: true }),
      submit: vi.fn(),
    };
    const navigation = {
      assign: vi.fn(),
      origin: 'https://www.example.test',
      replace: vi.fn(),
    };

    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginController
              flowId="flow-1"
              hasSession
              isSessionPending={false}
              navigation={navigation}
              transport={transport}
            />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    expect(container?.querySelector('[data-testid="security-reauthentication-message"]')?.textContent).toBe(
      enMessages.auth.login.securityReauthentication.description,
    );
  });

  it('starts authentication with an absolute same-origin return_to while storing the relative navigation target', async () => {
    const transport: UnifiedLoginTransport = {
      actionUrl: vi.fn(() => '/api/auth/login?flow=flow-1'),
      browserUrl: vi.fn(() => '/api/auth/login'),
      load: vi.fn(),
      submit: vi.fn(),
    };
    const navigation = {
      assign: vi.fn(),
      origin: 'https://www.example.test',
      replace: vi.fn(),
    };

    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginController
              hasSession={false}
              isSessionPending={false}
              navigation={navigation}
              redirectUrl="/admin?tab=users"
              transport={transport}
            />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    expect(transport.browserUrl).toHaveBeenCalledWith('https://www.example.test/admin?tab=users');
    expect(window.sessionStorage.getItem('auth_redirect')).toBe('/admin?tab=users');
    expect(navigation.assign).toHaveBeenCalledWith('/api/auth/login');
  });

  it('preserves anonymous newsletter intent through the flow callback and redirects only after explicit opt-in', async () => {
    const origin = 'https://www.example.test';
    const finalRedirect = '/from-newsletter-footer';
    const continuation = `${origin}/login?intent=newsletter&redirect=%2Ffrom-newsletter-footer`;
    const newsletterFlow = { ...codeFlow, id: 'newsletter-flow', return_to: continuation };
    const transport: UnifiedLoginTransport = {
      actionUrl: vi.fn(() => '/api/auth/login?flow=newsletter-flow'),
      browserUrl: vi.fn((returnTo) => `/api/auth/login${returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : ''}`),
      load: vi.fn().mockResolvedValue({ kind: 'continued', flow: newsletterFlow, ok: true }),
      submit: vi.fn().mockResolvedValue({ kind: 'completed', payload: { return_to: continuation } }),
    };
    const navigation = {
      assign: vi.fn(),
      origin,
      replace: vi.fn(),
    };
    const applyNewsletterSubscription = vi.fn().mockResolvedValue({ success: true });

    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginController
              key="newsletter-start"
              applyNewsletterSubscription={applyNewsletterSubscription}
              hasSession={false}
              isSessionPending={false}
              newsletterIntent
              navigation={navigation}
              redirectUrl={finalRedirect}
              transport={transport}
            />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    expect(transport.browserUrl).toHaveBeenCalledWith(continuation);
    expect(window.sessionStorage.getItem('auth_redirect')).toBe(finalRedirect);
    expect(navigation.assign).toHaveBeenCalledWith(`/api/auth/login?return_to=${encodeURIComponent(continuation)}`);

    navigation.assign.mockClear();
    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginController
              key="newsletter-callback"
              applyNewsletterSubscription={applyNewsletterSubscription}
              flowId="newsletter-flow"
              hasSession={false}
              isSessionPending={false}
              navigation={navigation}
              transport={transport}
            />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    expect(window.sessionStorage.getItem('auth_redirect')).toBe(finalRedirect);
    expect(container?.textContent).toContain(
      "After you sign in, we'll ask you to confirm your newsletter subscription.",
    );
    const inputs = Array.from(container?.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]') ?? []);
    expect(inputs).toHaveLength(6);
    await act(async () => {
      for (const [index, digit] of Array.from('123456').entries()) {
        setInputValue(inputs[index] as HTMLInputElement, digit);
        await Promise.resolve();
      }
      await Promise.resolve();
    });
    await flush();

    expect(applyNewsletterSubscription).not.toHaveBeenCalled();
    expect(container?.textContent).toContain('You are signed in. Subscribe to newsletter and campaign emails?');
    expect(navigation.assign).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();

    const subscribeButton = Array.from(container?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Subscribe to newsletter',
    );
    await act(async () => {
      subscribeButton?.click();
    });
    await flush();

    expect(applyNewsletterSubscription).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith(finalRedirect);
    expect(window.sessionStorage.getItem('auth_redirect')).toBeNull();
    expect(window.sessionStorage.getItem('newsletter_auth_continuation')).toBeNull();
  });

  it('keeps an ordinary flow ordinary when its callback query injects newsletter intent', async () => {
    window.sessionStorage.setItem('auth_redirect', '/ordinary-destination');
    rememberNewsletterAuthContinuation(
      '/login?intent=newsletter&redirect=%2Fstale-newsletter-destination',
      'https://www.example.test',
    );
    const transport: UnifiedLoginTransport = {
      actionUrl: vi.fn(() => '/api/auth/login?flow=flow-1'),
      browserUrl: vi.fn(() => '/api/auth/login'),
      load: vi.fn().mockResolvedValue({ kind: 'continued', flow: codeFlow, ok: true }),
      submit: vi.fn().mockResolvedValue({ kind: 'completed', payload: { return_to: '/after-login' } }),
    };
    const navigation = {
      assign: vi.fn(),
      origin: 'https://www.example.test',
      replace: vi.fn(),
    };
    const applyNewsletterSubscription = vi.fn().mockResolvedValue({ success: true });

    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginController
              applyNewsletterSubscription={applyNewsletterSubscription}
              flowId="flow-1"
              hasSession={false}
              isSessionPending={false}
              newsletterIntent
              navigation={navigation}
              transport={transport}
            />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    expect(window.sessionStorage.getItem('newsletter_auth_continuation')).toBeNull();

    const inputs = Array.from(container?.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]') ?? []);
    await act(async () => {
      for (const [index, digit] of Array.from('123456').entries()) {
        setInputValue(inputs[index] as HTMLInputElement, digit);
        await Promise.resolve();
      }
      await Promise.resolve();
    });
    await flush();

    expect(applyNewsletterSubscription).not.toHaveBeenCalled();
    expect(container?.textContent).not.toContain('Subscribe to newsletter and campaign emails?');
    expect(navigation.assign).toHaveBeenCalledWith('/ordinary-destination');
    expect(window.sessionStorage.getItem('auth_redirect')).toBeNull();
  });

  it('preserves a loaded newsletter continuation across an expired-flow restart', async () => {
    const origin = 'https://www.example.test';
    const finalRedirect = '/after-expired-newsletter';
    const continuation = `${origin}/login?intent=newsletter&redirect=%2Fafter-expired-newsletter`;
    const expiredFlow = { ...codeFlow, id: 'expired-newsletter-flow', return_to: continuation };
    const replacementFlow = { ...codeFlow, id: 'replacement-newsletter-flow', return_to: continuation };
    const browserUrl = vi.fn(
      (returnTo?: string | null) => `/api/auth/login${returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : ''}`,
    );
    const expiredTransport: UnifiedLoginTransport = {
      actionUrl: vi.fn(() => '/api/auth/login?flow=expired-newsletter-flow'),
      browserUrl,
      load: vi.fn().mockResolvedValue({ kind: 'continued', flow: expiredFlow, ok: true }),
      submit: vi.fn(async (_flowId, _payload, restartUrl) => ({ kind: 'restart' as const, url: restartUrl })),
    };
    const navigation = {
      assign: vi.fn(),
      origin,
      replace: vi.fn(),
    };
    const applyNewsletterSubscription = vi.fn().mockResolvedValue({ success: true });
    window.sessionStorage.setItem('auth_redirect', '/stale-auth-redirect');

    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginController
              key="expired-newsletter-flow"
              applyNewsletterSubscription={applyNewsletterSubscription}
              flowId="expired-newsletter-flow"
              hasSession={false}
              isSessionPending={false}
              navigation={navigation}
              redirectUrl="/query-must-not-win"
              transport={expiredTransport}
            />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    const firstInputs = Array.from(container?.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]') ?? []);
    await act(async () => {
      for (const [index, digit] of Array.from('123456').entries()) {
        setInputValue(firstInputs[index] as HTMLInputElement, digit);
        await Promise.resolve();
      }
      await Promise.resolve();
    });
    await flush();

    const canonicalContinuation = '/login?intent=newsletter&redirect=%2Fafter-expired-newsletter';
    const restartUrl = `/api/auth/login?return_to=${encodeURIComponent(`${origin}${canonicalContinuation}`)}`;
    expect(expiredTransport.submit).toHaveBeenCalledWith(
      'expired-newsletter-flow',
      expect.objectContaining({ code: '123456' }),
      restartUrl,
    );
    expect(navigation.assign).toHaveBeenCalledWith(restartUrl);

    navigation.assign.mockClear();
    const replacementTransport: UnifiedLoginTransport = {
      actionUrl: vi.fn(() => '/api/auth/login?flow=replacement-newsletter-flow'),
      browserUrl,
      load: vi.fn().mockResolvedValue({ kind: 'continued', flow: replacementFlow, ok: true }),
      submit: vi.fn().mockResolvedValue({ kind: 'completed', payload: { return_to: continuation } }),
    };
    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginController
              key="replacement-newsletter-flow"
              applyNewsletterSubscription={applyNewsletterSubscription}
              flowId="replacement-newsletter-flow"
              hasSession={false}
              isSessionPending={false}
              navigation={navigation}
              redirectUrl="/query-must-not-win"
              transport={replacementTransport}
            />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    const replacementInputs = Array.from(
      container?.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]') ?? [],
    );
    await act(async () => {
      for (const [index, digit] of Array.from('123456').entries()) {
        setInputValue(replacementInputs[index] as HTMLInputElement, digit);
        await Promise.resolve();
      }
      await Promise.resolve();
    });
    await flush();

    expect(container?.textContent).toContain('You are signed in. Subscribe to newsletter and campaign emails?');
    expect(applyNewsletterSubscription).not.toHaveBeenCalled();
    expect(navigation.assign).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();

    const subscribeButton = Array.from(container?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Subscribe to newsletter',
    );
    await act(async () => {
      subscribeButton?.click();
    });
    await flush();

    expect(applyNewsletterSubscription).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith(finalRedirect);
    expect(window.sessionStorage.getItem('auth_redirect')).toBeNull();
    expect(window.sessionStorage.getItem('newsletter_auth_continuation')).toBeNull();
  });

  it('clears a claimed newsletter continuation when the initial flow load fails terminally', async () => {
    const origin = 'https://www.example.test';
    rememberNewsletterAuthContinuation('/login?intent=newsletter&redirect=%2Fafter-auth', origin);
    const transport: UnifiedLoginTransport = {
      actionUrl: vi.fn(),
      browserUrl: vi.fn(() => '/api/auth/login'),
      load: vi.fn().mockResolvedValue({ kind: 'failed', status: 500, payload: null }),
      submit: vi.fn(),
    };

    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginController
              flowId="terminal-load-failure"
              hasSession={false}
              isSessionPending={false}
              navigation={{ assign: vi.fn(), origin, replace: vi.fn() }}
              transport={transport}
            />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    expect(window.sessionStorage.getItem('newsletter_auth_continuation')).toBeNull();
    expect(container?.textContent).toContain('Your login session expired. Please try again.');
  });

  it('preserves strict direct newsletter intent when the initial flow load returns 410', async () => {
    const origin = 'https://www.example.test';
    const finalRedirect = '/after-initial-flow-expiry';
    const canonicalContinuation = '/login?intent=newsletter&redirect=%2Fafter-initial-flow-expiry';
    const absoluteContinuation = `${origin}${canonicalContinuation}`;
    const browserUrl = vi.fn(
      (returnTo?: string | null) => `/api/auth/login${returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : ''}`,
    );
    const navigation = {
      assign: vi.fn(),
      origin,
      replace: vi.fn(),
    };
    const applyNewsletterSubscription = vi.fn().mockResolvedValue({ success: true });
    const directTransport: UnifiedLoginTransport = {
      actionUrl: vi.fn(),
      browserUrl,
      load: vi.fn(),
      submit: vi.fn(),
    };

    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginController
              key="initial-newsletter-entry"
              applyNewsletterSubscription={applyNewsletterSubscription}
              hasSession={false}
              isSessionPending={false}
              newsletterIntent
              navigation={navigation}
              redirectUrl={finalRedirect}
              transport={directTransport}
            />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    const authRestartUrl = `/api/auth/login?return_to=${encodeURIComponent(absoluteContinuation)}`;
    expect(navigation.assign).toHaveBeenCalledWith(authRestartUrl);
    navigation.assign.mockClear();

    const expiredTransport: UnifiedLoginTransport = {
      actionUrl: vi.fn(),
      browserUrl,
      load: vi.fn(async (_flowId, restartUrl) => ({ kind: 'restart' as const, url: restartUrl })),
      submit: vi.fn(),
    };
    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginController
              key="initial-expired-flow"
              applyNewsletterSubscription={applyNewsletterSubscription}
              flowId="initial-expired-flow"
              hasSession={false}
              isSessionPending={false}
              navigation={navigation}
              redirectUrl="/callback-query-must-not-win"
              transport={expiredTransport}
            />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    expect(expiredTransport.load).toHaveBeenCalledWith('initial-expired-flow', authRestartUrl);
    expect(navigation.assign).toHaveBeenCalledWith(authRestartUrl);
    navigation.assign.mockClear();
    window.sessionStorage.setItem('auth_redirect', '/stale-auth-redirect');

    const replacementFlow = { ...codeFlow, id: 'replacement-after-load-410', return_to: absoluteContinuation };
    const replacementTransport: UnifiedLoginTransport = {
      actionUrl: vi.fn(() => '/api/auth/login?flow=replacement-after-load-410'),
      browserUrl,
      load: vi.fn().mockResolvedValue({ kind: 'continued', flow: replacementFlow, ok: true }),
      submit: vi.fn().mockResolvedValue({ kind: 'completed', payload: { return_to: absoluteContinuation } }),
    };
    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginController
              key="replacement-after-load-410"
              applyNewsletterSubscription={applyNewsletterSubscription}
              flowId="replacement-after-load-410"
              hasSession={false}
              isSessionPending={false}
              navigation={navigation}
              redirectUrl="/callback-query-must-not-win"
              transport={replacementTransport}
            />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    const inputs = Array.from(container?.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]') ?? []);
    await act(async () => {
      for (const [index, digit] of Array.from('123456').entries()) {
        setInputValue(inputs[index] as HTMLInputElement, digit);
        await Promise.resolve();
      }
      await Promise.resolve();
    });
    await flush();

    expect(container?.textContent).toContain('You are signed in. Subscribe to newsletter and campaign emails?');
    expect(applyNewsletterSubscription).not.toHaveBeenCalled();
    expect(navigation.assign).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();

    const subscribeButton = Array.from(container?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Subscribe to newsletter',
    );
    await act(async () => {
      subscribeButton?.click();
    });
    await flush();

    expect(applyNewsletterSubscription).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith(finalRedirect);
    expect(window.sessionStorage.getItem('auth_redirect')).toBeNull();
    expect(window.sessionStorage.getItem('newsletter_auth_continuation')).toBeNull();
  });

  it('consumes a stored same-origin redirect for an already authenticated session', async () => {
    authMock.session = { user: { id: 'user-1' } };
    navigationMock.searchParams = new URLSearchParams();
    window.sessionStorage.setItem('auth_redirect', '/my/security');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginContent />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    expect(navigationMock.router.replace).toHaveBeenCalledWith('/my/security');
    expect(window.sessionStorage.getItem('auth_redirect')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not mutate from a newsletter intent GET and applies only after the signed-in user confirms', async () => {
    authMock.session = { user: { id: 'user-1' } };
    navigationMock.searchParams = new URLSearchParams('intent=newsletter&redirect=%2Fmy%2Fsettings');
    authMock.newsletterSubscription.mockResolvedValue({ success: true });
    window.sessionStorage.setItem('auth_redirect', '/stale-auth-redirect');

    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginController
              applyNewsletterSubscription={authMock.newsletterSubscription}
              hasSession
              isSessionPending={false}
              newsletterIntent
              navigation={{
                assign: vi.fn(),
                origin: 'https://www.example.test',
                replace: navigationMock.router.replace,
              }}
              redirectUrl="/my/settings"
              transport={{
                actionUrl: vi.fn(),
                browserUrl: vi.fn(),
                load: vi.fn(),
                submit: vi.fn(),
              }}
            />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    expect(authMock.newsletterSubscription).not.toHaveBeenCalled();
    expect(navigationMock.router.replace).not.toHaveBeenCalled();
    expect(container?.textContent).toContain('You are signed in. Subscribe to newsletter and campaign emails?');
    expect(container?.textContent).not.toContain('You are not subscribed');

    const subscribeButton = Array.from(container?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Subscribe to newsletter',
    );
    expect(subscribeButton).toBeDefined();

    await act(async () => {
      subscribeButton?.click();
    });
    await flush();

    expect(authMock.newsletterSubscription).toHaveBeenCalledTimes(1);
    expect(navigationMock.router.replace).toHaveBeenCalledWith('/my/settings');
    expect(window.sessionStorage.getItem('auth_redirect')).toBeNull();
  });

  it('retries a failed post-proof newsletter write and resumes the saved redirect after success', async () => {
    authMock.session = { user: { id: 'user-1' } };
    authMock.newsletterSubscription.mockResolvedValueOnce({ success: false }).mockResolvedValueOnce({ success: true });
    const navigation = {
      assign: vi.fn(),
      origin: 'https://www.example.test',
      replace: vi.fn(),
    };

    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginController
              applyNewsletterSubscription={authMock.newsletterSubscription}
              hasSession
              isSessionPending={false}
              newsletterIntent
              navigation={navigation}
              redirectUrl="/after-newsletter"
              transport={{
                actionUrl: vi.fn(),
                browserUrl: vi.fn(),
                load: vi.fn(),
                submit: vi.fn(),
              }}
            />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    const subscribeButton = Array.from(container?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Subscribe to newsletter',
    );
    await act(async () => {
      subscribeButton?.click();
    });
    await flush();

    expect(container?.querySelector('[role="alert"]')?.textContent).toContain('could not be saved');
    expect(navigation.replace).not.toHaveBeenCalled();

    const retryButton = Array.from(container?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Try again',
    );
    await act(async () => {
      retryButton?.click();
    });
    await flush();

    expect(authMock.newsletterSubscription).toHaveBeenCalledTimes(2);
    expect(navigation.replace).toHaveBeenCalledWith('/after-newsletter');
  });

  it('submits the exact six-digit value completed by PinInput', async () => {
    const rejectedCodeFlow = {
      ...codeFlow,
      ui: {
        ...codeFlow.ui,
        nodes: codeFlow.ui.nodes.map((node) =>
          node.attributes.name === 'code'
            ? {
                ...node,
                messages: [
                  {
                    id: 4000006,
                    type: 'error',
                    text: 'provider text must not be rendered',
                  },
                ],
              }
            : node,
        ),
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(codeFlow))
      .mockResolvedValueOnce(jsonResponse(rejectedCodeFlow, { status: 422 }));
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginContent />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]'));
    expect(inputs).toHaveLength(6);

    await act(async () => {
      for (const [index, digit] of Array.from('123456').entries()) {
        setInputValue(inputs[index] as HTMLInputElement, digit);
        await Promise.resolve();
      }
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      method: 'code',
      identifier: 'johndoe@example.com',
      csrf_token: 'csrf-token',
      code: '123456',
      transient_payload: { preferred_locale: 'en' },
    });
    expect(document.body.textContent).not.toContain('provider text must not be rendered');
  });

  it('returns every login action to a retryable state when explicit passkey login is cancelled', async () => {
    const cancellation = new DOMException('The operation was cancelled.', 'NotAllowedError');
    let rejectCredential: (error: unknown) => void = () => undefined;
    const credentialGet = vi.fn(
      () =>
        new Promise<Credential | null>((_resolve, reject) => {
          rejectCredential = reject;
        }),
    );
    vi.stubGlobal('PublicKeyCredential', class PublicKeyCredentialMock {});
    Object.defineProperty(window.navigator, 'credentials', {
      configurable: true,
      value: { get: credentialGet },
    });
    (window as unknown as Record<string, unknown>).__oryWebAuthnInitialized = true;
    (window as unknown as Record<string, unknown>).oryPasskeyLogin = () => {
      window.navigator.credentials.get({ publicKey: { challenge: new Uint8Array() } }).catch(() => undefined);
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(passkeyFlow)));

    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginContent />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    const passkeyButton = document.querySelector<HTMLButtonElement>('[data-testid="login-passkey"]');
    const emailButton = document.querySelector<HTMLButtonElement>('#login-email-code-submit');
    const socialButtons = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="provider"]'))
      .map((input) => input.form?.querySelector<HTMLButtonElement>('button'))
      .filter((button): button is HTMLButtonElement => Boolean(button));
    expect(passkeyButton?.disabled).toBe(false);
    expect(emailButton?.disabled).toBe(false);
    expect(socialButtons).toHaveLength(2);
    expect(socialButtons.every((button) => !button.disabled)).toBe(true);
    await act(async () => {
      passkeyButton?.click();
      await Promise.resolve();
    });

    expect(passkeyButton?.hasAttribute('data-loading')).toBe(true);
    expect(emailButton?.disabled).toBe(true);
    expect(emailButton?.hasAttribute('data-loading')).toBe(false);
    expect(socialButtons.every((button) => button.disabled)).toBe(true);
    await act(async () => {
      rejectCredential(cancellation);
      await Promise.resolve();
    });
    await flush();

    expect(credentialGet).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(passkeyButton?.disabled).toBe(false);
    expect(passkeyButton?.hasAttribute('data-loading')).toBe(false);
    expect(emailButton?.disabled).toBe(false);
    expect(emailButton?.hasAttribute('data-loading')).toBe(false);
    expect(socialButtons.every((button) => !button.disabled)).toBe(true);
  });

  it('places passkey login after the email continue action', async () => {
    vi.stubGlobal('PublicKeyCredential', class PublicKeyCredentialMock {});
    Object.defineProperty(window.navigator, 'credentials', {
      configurable: true,
      value: { get: vi.fn() },
    });
    (window as unknown as Record<string, unknown>).__oryWebAuthnInitialized = true;
    (window as unknown as Record<string, unknown>).oryPasskeyLogin = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(passkeyFlow)));

    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginContent />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    const emailButton = document.querySelector<HTMLButtonElement>('#login-email-code-submit');
    const passkeyButton = document.querySelector<HTMLButtonElement>('[data-testid="login-passkey"]');
    expect(emailButton).not.toBeNull();
    expect(passkeyButton).not.toBeNull();
    if (!emailButton || !passkeyButton) {
      throw new Error('expected email and passkey login actions');
    }
    expect(emailButton.compareDocumentPosition(passkeyButton) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(emailButton.style.height).toBe(passkeyButton.style.height);
  });

  it('shows only the email action as loading while disabling passkey and social alternatives', async () => {
    vi.stubGlobal('PublicKeyCredential', class PublicKeyCredentialMock {});
    Object.defineProperty(window.navigator, 'credentials', {
      configurable: true,
      value: { get: vi.fn() },
    });
    (window as unknown as Record<string, unknown>).__oryWebAuthnInitialized = true;
    (window as unknown as Record<string, unknown>).oryPasskeyLogin = vi.fn();
    let resolveSubmission: (response: Response) => void = () => undefined;
    const pendingSubmission = new Promise<Response>((resolve) => {
      resolveSubmission = resolve;
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(passkeyFlow)).mockReturnValueOnce(pendingSubmission);
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginContent />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    const emailInput = document.querySelector<HTMLInputElement>('#login-email-input');
    const emailButton = document.querySelector<HTMLButtonElement>('#login-email-code-submit');
    const passkeyButton = document.querySelector<HTMLButtonElement>('[data-testid="login-passkey"]');
    const socialButtons = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="provider"]'))
      .map((input) => input.form?.querySelector<HTMLButtonElement>('button'))
      .filter((button): button is HTMLButtonElement => Boolean(button));
    setInputValue(emailInput as HTMLInputElement, 'johndoe@example.com');
    await act(async () => {
      emailButton?.click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(emailButton?.hasAttribute('data-loading')).toBe(true);
    expect(passkeyButton?.disabled).toBe(true);
    expect(passkeyButton?.hasAttribute('data-loading')).toBe(false);
    expect(socialButtons.every((button) => button.disabled)).toBe(true);

    resolveSubmission(jsonResponse(codeFlow));
    await flush();
  });

  it('shows only the selected social action as loading while disabling every alternative', async () => {
    vi.stubGlobal('PublicKeyCredential', class PublicKeyCredentialMock {});
    Object.defineProperty(window.navigator, 'credentials', {
      configurable: true,
      value: { get: vi.fn() },
    });
    (window as unknown as Record<string, unknown>).__oryWebAuthnInitialized = true;
    (window as unknown as Record<string, unknown>).oryPasskeyLogin = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(passkeyFlow)));

    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginContent />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    const providerInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="provider"]'));
    const googleInput = providerInputs.find((input) => input.value === 'google');
    const githubInput = providerInputs.find((input) => input.value === 'github');
    const googleButton = googleInput?.form?.querySelector<HTMLButtonElement>('button');
    const githubButton = githubInput?.form?.querySelector<HTMLButtonElement>('button');
    const emailButton = document.querySelector<HTMLButtonElement>('#login-email-code-submit');
    const passkeyButton = document.querySelector<HTMLButtonElement>('[data-testid="login-passkey"]');

    await act(async () => {
      googleInput?.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(googleButton?.hasAttribute('data-loading')).toBe(true);
    expect(githubButton?.disabled).toBe(true);
    expect(emailButton?.disabled).toBe(true);
    expect(passkeyButton?.disabled).toBe(true);
  });

  it('keeps the empty-email continue action visibly primary without submitting an empty address', async () => {
    const emailEntryFlow = {
      ...passkeyFlow,
      ui: {
        ...passkeyFlow.ui,
        nodes: passkeyFlow.ui.nodes.filter((node) => node.group !== 'passkey'),
      },
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(emailEntryFlow));
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider>
            <LoginContent />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });
    await flush();

    const emailButton = document.querySelector<HTMLButtonElement>('#login-email-code-submit');
    expect(emailButton?.disabled).toBe(false);
    expect(emailButton?.getAttribute('data-variant')).toBe('filled');
    emailButton?.click();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
