// @vitest-environment jsdom

import { ManifestProvider } from '@/lib/contexts/ManifestContext';
import { DEFAULT_SITE_SETTINGS_VIEW } from '@/lib/types/site-setting/config';
import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enMessages from '@/messages/en.json';
import { render, screen, waitFor, within } from '@/test/render';
import { LoginContent } from './LoginContent';
import { LoginController } from './LoginController';
import { rememberNewsletterAuthContinuation } from './login-redirect';
import { createUnifiedLoginTransport, type UnifiedLoginTransport } from './unified-login-transport';

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

let credentialsDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  navigationMock.router.push.mockReset();
  navigationMock.router.replace.mockReset();
  navigationMock.searchParams = new URLSearchParams('flow=flow-1');
  authMock.session = null;
  authMock.newsletterSubscription.mockReset();
  window.sessionStorage.clear();
  credentialsDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'credentials');
});

afterEach(() => {
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

describe('LoginContent', () => {
  it('keeps legal links distinguishable within their surrounding login prose', async () => {
    const transport: UnifiedLoginTransport = {
      actionUrl: vi.fn(() => '/api/auth/login?flow=flow-1'),
      browserUrl: vi.fn(() => '/api/auth/login'),
      load: vi.fn().mockResolvedValue({ kind: 'continued', flow: codeFlow, ok: true }),
      submit: vi.fn(),
    };
    render(
      <DesignSystemProvider locale="en" forceTheme="ocean-dark">
        <LoginContent transport={transport} />
      </DesignSystemProvider>,
    );
    const terms = await screen.findByRole('link', { name: 'Terms of Service' });
    const privacy = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(terms).toHaveAttribute('href', '/terms');
    expect(privacy).toHaveAttribute('href', '/privacy');
    expect(terms).toHaveAttribute('data-appearance', 'content');
    expect(privacy).toHaveAttribute('data-appearance', 'content');
  });

  it.each(['submit', 'flow'] as const)(
    'replaces the privileged refresh intro with one %s failure alert',
    async (failure) => {
      const refreshFlow = {
        ...codeFlow,
        refresh: true,
        return_to: '/my/security?resume_account_security_action=1',
        ui: {
          ...codeFlow.ui,
          nodes: codeFlow.ui.nodes.filter((node) => !['code', 'resend'].includes(node.attributes.name)),
        },
      };
      const transport: UnifiedLoginTransport = {
        actionUrl: vi.fn(() => '/api/auth/login?flow=flow-1'),
        browserUrl: vi.fn(() => '/api/auth/login'),
        load: vi.fn().mockResolvedValue({ kind: 'continued', flow: refreshFlow, ok: true }),
        submit: vi.fn().mockResolvedValue(
          failure === 'submit'
            ? { kind: 'failed' }
            : {
                kind: 'continued',
                ok: false,
                flow: {
                  ...refreshFlow,
                  ui: { ...refreshFlow.ui, messages: [{ id: 4000001, type: 'error', text: 'Provider failure' }] },
                },
              },
        ),
      };
      const navigation = {
        assign: vi.fn(),
        origin: 'https://www.example.test',
        replace: vi.fn(),
      };

      const { user } = render(
        <LoginController
          flowId="flow-1"
          hasSession
          isSessionPending={false}
          navigation={navigation}
          transport={transport}
        />,
      );

      expect(await screen.findByText(enMessages.auth.login.securityReauthentication.description)).toBeVisible();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      await user.type(screen.getByRole('textbox', { name: enMessages.common.labels.email }), 'june@example.com');
      await user.click(screen.getByRole('button', { name: enMessages.auth.login.emailCode }));

      expect(await screen.findByRole('alert')).toHaveTextContent(enMessages.auth.login.errors.loginFailed);
      expect(screen.getAllByRole('alert')).toHaveLength(1);
      expect(screen.queryByText(enMessages.auth.login.securityReauthentication.description)).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: enMessages.common.labels.email })).toHaveAccessibleDescription(
        enMessages.auth.login.errors.loginFailed,
      );
    },
  );

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

    render(
      <LoginController
        hasSession={false}
        isSessionPending={false}
        navigation={navigation}
        redirectUrl="/admin?tab=users"
        transport={transport}
      />,
    );

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

    const { user, rerender } = render(
      <LoginController
        key="newsletter-start"
        applyNewsletterSubscription={applyNewsletterSubscription}
        hasSession={false}
        isSessionPending={false}
        newsletterIntent
        navigation={navigation}
        redirectUrl={finalRedirect}
        transport={transport}
      />,
    );

    expect(transport.browserUrl).toHaveBeenCalledWith(continuation);
    expect(window.sessionStorage.getItem('auth_redirect')).toBe(finalRedirect);
    expect(navigation.assign).toHaveBeenCalledWith(`/api/auth/login?return_to=${encodeURIComponent(continuation)}`);

    navigation.assign.mockClear();
    rerender(
      <LoginController
        key="newsletter-callback"
        applyNewsletterSubscription={applyNewsletterSubscription}
        flowId="newsletter-flow"
        hasSession={false}
        isSessionPending={false}
        navigation={navigation}
        transport={transport}
      />,
    );

    expect(window.sessionStorage.getItem('auth_redirect')).toBe(finalRedirect);
    expect(
      await screen.findByText("After you sign in, we'll ask you to confirm your newsletter subscription."),
    ).toBeVisible();
    const inputs = await screen.findAllByRole('textbox', { name: /^6-digit sign-in code [1-6]$/ });
    expect(inputs).toHaveLength(6);
    await user.type(inputs[0], '123456');

    expect(applyNewsletterSubscription).not.toHaveBeenCalled();
    expect(await screen.findByText('You are signed in. Subscribe to newsletter and campaign emails?')).toBeVisible();
    expect(navigation.assign).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();

    const subscribeButton = await screen.findByRole('button', { name: 'Subscribe to newsletter' });
    await user.click(subscribeButton);

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

    const { user } = render(
      <LoginController
        applyNewsletterSubscription={applyNewsletterSubscription}
        flowId="flow-1"
        hasSession={false}
        isSessionPending={false}
        newsletterIntent
        navigation={navigation}
        transport={transport}
      />,
    );

    const firstCodeInput = await screen.findByRole('textbox', {
      name: `${enMessages.auth.login.code.label} 1`,
    });
    expect(window.sessionStorage.getItem('newsletter_auth_continuation')).toBeNull();

    await user.type(firstCodeInput, '123456');

    expect(applyNewsletterSubscription).not.toHaveBeenCalled();
    expect(screen.queryByText('Subscribe to newsletter and campaign emails?')).not.toBeInTheDocument();
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

    const { user, rerender } = render(
      <LoginController
        key="expired-newsletter-flow"
        applyNewsletterSubscription={applyNewsletterSubscription}
        flowId="expired-newsletter-flow"
        hasSession={false}
        isSessionPending={false}
        navigation={navigation}
        redirectUrl="/query-must-not-win"
        transport={expiredTransport}
      />,
    );

    await user.type(await screen.findByRole('textbox', { name: `${enMessages.auth.login.code.label} 1` }), '123456');

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
    rerender(
      <LoginController
        key="replacement-newsletter-flow"
        applyNewsletterSubscription={applyNewsletterSubscription}
        flowId="replacement-newsletter-flow"
        hasSession={false}
        isSessionPending={false}
        navigation={navigation}
        redirectUrl="/query-must-not-win"
        transport={replacementTransport}
      />,
    );

    await user.type(await screen.findByRole('textbox', { name: `${enMessages.auth.login.code.label} 1` }), '123456');

    expect(await screen.findByText('You are signed in. Subscribe to newsletter and campaign emails?')).toBeVisible();
    expect(applyNewsletterSubscription).not.toHaveBeenCalled();
    expect(navigation.assign).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();

    const subscribeButton = await screen.findByRole('button', { name: 'Subscribe to newsletter' });
    await user.click(subscribeButton);

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

    render(
      <LoginController
        flowId="terminal-load-failure"
        hasSession={false}
        isSessionPending={false}
        navigation={{ assign: vi.fn(), origin, replace: vi.fn() }}
        transport={transport}
      />,
    );

    expect(await screen.findByText('Your login session expired. Please try again.')).toBeVisible();
    expect(window.sessionStorage.getItem('newsletter_auth_continuation')).toBeNull();
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

    const { user, rerender } = render(
      <LoginController
        key="initial-newsletter-entry"
        applyNewsletterSubscription={applyNewsletterSubscription}
        hasSession={false}
        isSessionPending={false}
        newsletterIntent
        navigation={navigation}
        redirectUrl={finalRedirect}
        transport={directTransport}
      />,
    );

    const authRestartUrl = `/api/auth/login?return_to=${encodeURIComponent(absoluteContinuation)}`;
    expect(navigation.assign).toHaveBeenCalledWith(authRestartUrl);
    navigation.assign.mockClear();

    const expiredTransport: UnifiedLoginTransport = {
      actionUrl: vi.fn(),
      browserUrl,
      load: vi.fn(async (_flowId, restartUrl) => ({ kind: 'restart' as const, url: restartUrl })),
      submit: vi.fn(),
    };
    rerender(
      <LoginController
        key="initial-expired-flow"
        applyNewsletterSubscription={applyNewsletterSubscription}
        flowId="initial-expired-flow"
        hasSession={false}
        isSessionPending={false}
        navigation={navigation}
        redirectUrl="/callback-query-must-not-win"
        transport={expiredTransport}
      />,
    );

    await waitFor(() => expect(navigation.assign).toHaveBeenCalledWith(authRestartUrl));
    expect(expiredTransport.load).toHaveBeenCalledWith('initial-expired-flow', authRestartUrl);
    navigation.assign.mockClear();
    window.sessionStorage.setItem('auth_redirect', '/stale-auth-redirect');

    const replacementFlow = { ...codeFlow, id: 'replacement-after-load-410', return_to: absoluteContinuation };
    const replacementTransport: UnifiedLoginTransport = {
      actionUrl: vi.fn(() => '/api/auth/login?flow=replacement-after-load-410'),
      browserUrl,
      load: vi.fn().mockResolvedValue({ kind: 'continued', flow: replacementFlow, ok: true }),
      submit: vi.fn().mockResolvedValue({ kind: 'completed', payload: { return_to: absoluteContinuation } }),
    };
    rerender(
      <LoginController
        key="replacement-after-load-410"
        applyNewsletterSubscription={applyNewsletterSubscription}
        flowId="replacement-after-load-410"
        hasSession={false}
        isSessionPending={false}
        navigation={navigation}
        redirectUrl="/callback-query-must-not-win"
        transport={replacementTransport}
      />,
    );

    await user.type(await screen.findByRole('textbox', { name: `${enMessages.auth.login.code.label} 1` }), '123456');

    expect(await screen.findByText('You are signed in. Subscribe to newsletter and campaign emails?')).toBeVisible();
    expect(applyNewsletterSubscription).not.toHaveBeenCalled();
    expect(navigation.assign).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();

    const subscribeButton = await screen.findByRole('button', { name: 'Subscribe to newsletter' });
    await user.click(subscribeButton);

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

    render(<LoginContent />);

    expect(navigationMock.router.replace).toHaveBeenCalledWith('/my/security');
    expect(window.sessionStorage.getItem('auth_redirect')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not mutate from a newsletter intent GET and applies only after the signed-in user confirms', async () => {
    authMock.session = { user: { id: 'user-1' } };
    navigationMock.searchParams = new URLSearchParams('intent=newsletter&redirect=%2Fmy%2Fsettings');
    authMock.newsletterSubscription.mockResolvedValue({ success: true });
    window.sessionStorage.setItem('auth_redirect', '/stale-auth-redirect');

    const { user } = render(
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
      />,
    );

    expect(authMock.newsletterSubscription).not.toHaveBeenCalled();
    expect(navigationMock.router.replace).not.toHaveBeenCalled();
    expect(await screen.findByText('You are signed in. Subscribe to newsletter and campaign emails?')).toBeVisible();
    expect(screen.queryByText('You are not subscribed')).not.toBeInTheDocument();

    const subscribeButton = await screen.findByRole('button', { name: 'Subscribe to newsletter' });
    expect(subscribeButton).toBeDefined();

    await user.click(subscribeButton);

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

    const { user } = render(
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
      />,
    );

    const subscribeButton = await screen.findByRole('button', { name: 'Subscribe to newsletter' });
    await user.click(subscribeButton);

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved');
    expect(navigation.replace).not.toHaveBeenCalled();

    const retryButton = await screen.findByRole('button', { name: 'Try again' });
    await user.click(retryButton);

    expect(authMock.newsletterSubscription).toHaveBeenCalledTimes(2);
    expect(navigation.replace).toHaveBeenCalledWith('/after-newsletter');
  });

  it('keeps the entered PIN, view and site loader through a deferred code POST and permits retry', async () => {
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
    let finish!: (response: Response) => void;
    const submission = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(codeFlow))
      .mockReturnValueOnce(submission)
      .mockResolvedValueOnce(jsonResponse(rejectedCodeFlow, { status: 422 }));
    vi.stubGlobal('fetch', fetchMock);

    const { user } = render(
      <ManifestProvider
        manifest={{
          settings: {
            ...DEFAULT_SITE_SETTINGS_VIEW,
            favicon_asset_set: null,
            site_og_image_url: null,
            loader_urls: ['https://assets.example.test/login-loader.gif'],
          },
          menus: { $typeName: 'api.open.v1.Menus', header: [], secondary: [], footer: [], avatarDropdown: [] },
        }}
      >
        <LoginContent />
      </ManifestProvider>,
    );

    const inputs = await screen.findAllByRole('textbox', { name: /^6-digit sign-in code [1-6]$/ });
    const heading = screen.getByRole('heading', { level: 1 });
    const view = screen.getByRole('group', { name: enMessages.auth.login.title });
    expect(inputs).toHaveLength(6);
    await user.type(inputs[0], '123456');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      method: 'code',
      identifier: 'johndoe@example.com',
      csrf_token: 'csrf-token',
      code: '123456',
      transient_payload: { preferred_locale: 'en' },
    });
    expect(inputs[5]).toHaveFocus();
    const loader = screen.getByRole('status', { name: enMessages.common.states.loading });
    expect(loader).toHaveTextContent(enMessages.auth.verification.sentEmail.submitting);
    expect(loader).toHaveAttribute('data-placement', 'flow');
    expect(within(view).getByRole('img', { name: enMessages.common.states.loading })).toHaveAttribute(
      'src',
      'https://assets.example.test/login-loader.gif',
    );
    expect(screen.getByRole('heading', { level: 1 })).toBe(heading);
    expect(inputs.map((input) => (input as HTMLInputElement).value).join('')).toBe('123456');
    for (const input of inputs) {
      expect(input).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: enMessages.auth.login.code.resend })).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await act(async () => finish(jsonResponse(rejectedCodeFlow, { status: 422 })));
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(enMessages.auth.login.code.invalid);
    expect(inputs[0]).toHaveAttribute('aria-invalid', 'true');
    expect(inputs[0]).toHaveAttribute('aria-describedby', expect.stringContaining(error.id));
    expect(screen.queryByText('provider text must not be rendered')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: enMessages.auth.login.title })).toBe(view);
    expect(screen.getByRole('heading', { level: 1 })).toBe(heading);
    expect(inputs[5]).toHaveFocus();
    expect(screen.queryByRole('status', { name: enMessages.common.states.loading })).not.toBeInTheDocument();
    expect(inputs.map((input) => (input as HTMLInputElement).value).join('')).toBe('123456');
    expect(screen.getByRole('button', { name: enMessages.auth.login.code.resend })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: enMessages.auth.login.code.submit }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
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

    const { user } = render(<LoginContent />);

    const passkeyButton = await screen.findByRole('button', { name: enMessages.auth.login.passkey });
    await waitFor(() => expect(passkeyButton).toBeEnabled());
    const emailButton = await screen.findByRole('button', { name: enMessages.auth.login.emailCode });
    const socialButtons = screen.getAllByRole('button', { name: /Continue with (Google|GitHub)/ });
    expect(passkeyButton).toBeEnabled();
    expect(emailButton).toBeEnabled();
    expect(socialButtons).toHaveLength(2);
    for (const button of socialButtons) {
      expect(button).toBeEnabled();
    }
    await user.click(passkeyButton);

    expect(passkeyButton).toHaveAttribute('data-loading');
    expect(emailButton).toBeDisabled();
    expect(emailButton).not.toHaveAttribute('data-loading');
    for (const button of socialButtons) {
      expect(button).toBeDisabled();
    }
    await act(async () => {
      rejectCredential(cancellation);
    });

    expect(credentialGet).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(passkeyButton).toBeEnabled();
    expect(passkeyButton).not.toHaveAttribute('data-loading');
    expect(emailButton).toBeEnabled();
    expect(emailButton).not.toHaveAttribute('data-loading');
    for (const button of socialButtons) {
      expect(button).toBeEnabled();
    }
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

    const { user } = render(<LoginContent />);

    const emailInput = await screen.findByRole('textbox', { name: enMessages.common.labels.email });
    const emailButton = await screen.findByRole('button', { name: enMessages.auth.login.emailCode });
    const passkeyButton = await screen.findByRole('button', { name: enMessages.auth.login.passkey });
    await waitFor(() => expect(passkeyButton).toBeEnabled());
    const socialButtons = screen.getAllByRole('button', { name: /Continue with (Google|GitHub)/ });
    await user.type(emailInput, 'johndoe@example.com');
    await user.click(emailButton);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(emailButton).toHaveAttribute('data-loading');
    expect(passkeyButton).toBeDisabled();
    expect(passkeyButton).not.toHaveAttribute('data-loading');
    for (const button of socialButtons) {
      expect(button).toBeDisabled();
    }

    await act(async () => {
      resolveSubmission(jsonResponse(codeFlow));
      await pendingSubmission;
    });
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

    // Contain the provider's native navigation, which jsdom does not implement.
    const { user } = render(
      <div onSubmit={(event) => event.preventDefault()}>
        <LoginContent />
      </div>,
    );

    const googleButton = await screen.findByRole('button', { name: 'Continue with Google' });
    const githubButton = screen.getByRole('button', { name: 'Continue with GitHub' });
    const emailButton = screen.getByRole('button', { name: enMessages.auth.login.emailCode });
    const passkeyButton = screen.getByRole('button', { name: enMessages.auth.login.passkey });
    await waitFor(() => expect(passkeyButton).toBeEnabled());

    await user.click(googleButton);

    expect(googleButton).toHaveAttribute('data-loading');
    expect(githubButton).toBeDisabled();
    expect(emailButton).toBeDisabled();
    expect(passkeyButton).toBeDisabled();
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

    const { user } = render(<LoginContent />);

    const emailButton = await screen.findByRole('button', { name: enMessages.auth.login.emailCode });
    expect(emailButton).toBeEnabled();
    expect(emailButton).toHaveAttribute('data-emphasis', 'strong');
    await user.click(emailButton);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

it('marks resend as the pending action while the code submit control stays idle', async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(codeFlow))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
  );
  const { user } = render(<LoginContent />);
  const resend = await screen.findByRole('button', { name: enMessages.auth.login.code.resend });
  await user.click(resend);
  expect(resend).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('button', { name: enMessages.auth.login.code.submit })).not.toHaveAttribute(
    'aria-busy',
    'true',
  );
  expect(screen.getByRole('button', { name: enMessages.auth.login.code.submit })).toBeDisabled();
  await act(async () => finish(jsonResponse(codeFlow)));
  expect(resend).not.toHaveAttribute('aria-busy', 'true');
});

it('hides the previous login flow and ignores its submission after a target change', async () => {
  let finish!: (response: Response) => void;
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse(codeFlow))
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(jsonResponse({ ...codeFlow, id: 'flow-2' }));
  vi.stubGlobal('fetch', fetchMock);
  const { user, rerender } = render(<LoginContent />);
  await user.click(await screen.findByRole('button', { name: enMessages.auth.login.code.resend }));
  navigationMock.searchParams = new URLSearchParams('flow=flow-2');
  rerender(<LoginContent />);
  await screen.findByRole('button', { name: enMessages.auth.login.code.resend });
  await act(async () =>
    finish(
      jsonResponse({ ...codeFlow, ui: { ...codeFlow.ui, messages: [{ id: 1, type: 'error', text: 'old failure' }] } }),
    ),
  );
  expect(screen.queryByText(enMessages.auth.login.code.invalid)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: enMessages.auth.login.code.resend })).toBeEnabled();
});

it.each(['continued', 'completed'] as const)(
  'ignores an old %s submission after A → B → A without clearing the new pending action',
  async (outcome) => {
    let finishOld!: (response: Response) => void;
    let finishNew!: (response: Response) => void;
    const oldSubmission = new Promise<Response>((resolve) => {
      finishOld = resolve;
    });
    const newSubmission = new Promise<Response>((resolve) => {
      finishNew = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(codeFlow))
      .mockReturnValueOnce(oldSubmission)
      .mockResolvedValueOnce(jsonResponse({ ...codeFlow, id: 'flow-2' }))
      .mockResolvedValueOnce(jsonResponse(codeFlow))
      .mockReturnValueOnce(newSubmission);
    const transport = createUnifiedLoginTransport(fetchMock);
    const navigation = { origin: window.location.origin, assign: vi.fn(), replace: vi.fn() };
    const props = { hasSession: false, isSessionPending: false, navigation, transport };
    const { user, rerender } = render(<LoginController {...props} flowId="flow-1" />);
    await user.click(await screen.findByRole('button', { name: enMessages.auth.login.code.resend }));
    rerender(<LoginController {...props} flowId="flow-2" />);
    await screen.findByRole('button', { name: enMessages.auth.login.code.resend });
    rerender(<LoginController {...props} flowId="flow-1" />);
    const resend = await screen.findByRole('button', { name: enMessages.auth.login.code.resend });
    await user.click(resend);
    expect(resend).toHaveAttribute('aria-busy', 'true');
    await act(async () =>
      finishOld(
        outcome === 'completed'
          ? jsonResponse({ session: { id: 'old-session' } })
          : jsonResponse(
              { ...codeFlow, ui: { ...codeFlow.ui, messages: [{ id: 1, type: 'error', text: 'old failure' }] } },
              { status: 422 },
            ),
      ),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: enMessages.auth.login.code.resend })).toBe(resend);
    expect(resend).toHaveAttribute('aria-busy', 'true');
    expect(navigation.assign).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
    await act(async () => finishNew(jsonResponse(codeFlow)));
    expect(screen.getByRole('button', { name: /Send a new code in/ })).toBeDisabled();
    expect(resend).not.toHaveAttribute('aria-busy', 'true');
  },
);
