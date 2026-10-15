// @vitest-environment jsdom
import { act, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useColorScheme, DesignSystemProvider } from './DesignSystemProvider';
import { COLOR_SCHEME_STORAGE_KEY } from '@/lib/theme/color-scheme';
import { clientMessageCoverage, selectClientMessages, type ClientMessages } from '@/lib/i18n/client-messages';
import type { ClientMessageCoverage } from '@/lib/i18n/client-message-scope';
import { getMessagesForLocale } from '@/lib/i18n/messages';
import { ClientMessagesProvider } from './ClientMessagesProvider';
const mocks = vi.hoisted(() => ({
  loadMessages: vi.fn(),
  pathname: '/',
  search: '',
  session: null as { data: unknown } | null,
}));
vi.mock('@/lib/providers/SessionProvider', () => ({
  useSessionContext: () => mocks.session,
}));
vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    unoptimized,
    preload,
  }: {
    src: string;
    alt: string;
    unoptimized?: boolean;
    preload?: boolean;
  }) => (
    <img src={src} alt={alt} loading="lazy" data-unoptimized={String(unoptimized)} data-preload={String(preload)} />
  ),
}));
vi.mock('@/lib/i18n/client-message-loaders', () => ({
  loadClientMessagesForLocale: mocks.loadMessages,
}));
// Probe context inside the real loading view: a nested default provider would reset both values.
vi.mock('@/components/core/LoadingSurface', async () => {
  const actual = await vi.importActual<typeof import('@/components/core/LoadingSurface')>(
    '@/components/core/LoadingSurface',
  );
  return {
    ...actual,
    PageLoaderView: (props: ComponentProps<typeof actual.PageLoaderView>) => {
      const { colorScheme } = useColorScheme();
      return (
        <div data-testid="loader-theme" data-color-scheme={colorScheme}>
          <actual.PageLoaderView {...props} />
        </div>
      );
    },
  };
});
const PUBLIC_COVERAGE = clientMessageCoverage('/');
let publicMessages: Partial<ClientMessages>;
let enMessages: ClientMessages;
let koMessages: ClientMessages;
function AuthTitle() {
  const t = useTranslations('auth.login');
  return <output data-testid="auth-title">{t('title')}</output>;
}
function PrivacyTitle() {
  const t = useTranslations('common.states');
  return <output data-testid="privacy-title">{t('loading')}</output>;
}
function RouteTitle() {
  return usePathname() === '/login' ? <AuthTitle /> : <span data-testid="public-page">Public page</span>;
}
let container: HTMLDivElement;
let root: Root;
function renderProvider({
  locale = 'en',
  messages = publicMessages,
  messageCoverage = PUBLIC_COVERAGE,
  children = <AuthTitle />,
  loaderImageSrc,
  loaderImageUnoptimized,
}: {
  locale?: string;
  messages?: Partial<ClientMessages>;
  messageCoverage?: ClientMessageCoverage;
  children?: ReactNode;
  loaderImageSrc?: string | null;
  loaderImageUnoptimized?: boolean;
} = {}) {
  root.render(
    <DesignSystemProvider defaultColorScheme="dark">
      <ClientMessagesProvider
        locale={locale}
        messages={messages}
        messageCoverage={messageCoverage}
        loaderImageSrc={loaderImageSrc}
        loaderImageUnoptimized={loaderImageUnoptimized}
      >
        {children}
      </ClientMessagesProvider>
    </DesignSystemProvider>,
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
beforeEach(async () => {
  enMessages = await getMessagesForLocale('en');
  koMessages = await getMessagesForLocale('ko');
  publicMessages = selectClientMessages(enMessages, { pathWithSearch: '/' });
  window.localStorage.removeItem(COLOR_SCHEME_STORAGE_KEY);
  document.cookie = `${COLOR_SCHEME_STORAGE_KEY}=; Path=/; Max-Age=0`;
  mocks.pathname = '/';
  mocks.search = '';
  mocks.loadMessages.mockReset();
  mocks.session = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
describe('ClientMessagesProvider', () => {
  it('server-renders the configured GIF on the first pending catalogue paint without generic visible text', async () => {
    mocks.pathname = '/login';
    const pending = deferred<ClientMessages>();
    mocks.loadMessages.mockReturnValue(pending.promise);
    const loaderImageSrc = 'https://cdn.example.com/loader.gif?version=2';
    const koPublicMessages = selectClientMessages(koMessages, { pathWithSearch: '/' });
    const markup = renderToStaticMarkup(
      <DesignSystemProvider defaultColorScheme="dark">
        <ClientMessagesProvider
          locale="ko"
          messages={koPublicMessages}
          messageCoverage={PUBLIC_COVERAGE}
          loaderImageSrc={loaderImageSrc}
          loaderImageUnoptimized
        >
          <AuthTitle />
        </ClientMessagesProvider>
      </DesignSystemProvider>,
    );
    expect(markup).toContain(loaderImageSrc);
    expect(markup).not.toContain('rel="preload" as="image"');
    expect(markup).toContain(`aria-label="${koMessages.common.states.loading}"`);
    await act(async () =>
      renderProvider({ locale: 'ko', messages: koPublicMessages, loaderImageSrc, loaderImageUnoptimized: true }),
    );
    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toBe('');
    expect(status?.querySelector('img')?.getAttribute('src')).toBe(loaderImageSrc);
    expect(status?.querySelector('img')?.getAttribute('data-unoptimized')).toBe('true');
    expect(status?.querySelector('img')?.getAttribute('data-preload')).toBe('undefined');
    await act(async () => {
      pending.resolve(koMessages);
      await pending.promise;
    });
    expect(container.querySelector('[data-testid="auth-title"]')?.textContent).toBe('로그인');
  });
  it('uses a quiet accessible pending surface for empty configuration and ignores a cancelled catalogue load', async () => {
    const pending = deferred<ClientMessages>();
    mocks.pathname = '/login';
    mocks.loadMessages.mockReturnValue(pending.promise);
    await act(async () => renderProvider());
    expect(container.querySelector('[role="status"]')?.textContent).toBe('');
    expect(container.querySelector('[data-testid="loader-theme"]')?.getAttribute('data-color-scheme')).toBe('dark');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.mantine-Loader-root')).toBeNull();
    mocks.pathname = '/';
    await act(async () => renderProvider({ children: <RouteTitle /> }));
    await act(async () => {
      pending.resolve(enMessages);
      await pending.promise;
    });
    expect(container.querySelector('[data-testid="public-page"]')).not.toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
  it('loads the full catalogue before showing private messages after public-to-login navigation', async () => {
    const enLoad = deferred<ClientMessages>();
    mocks.loadMessages.mockReturnValue(enLoad.promise);
    await act(async () => renderProvider({ children: <RouteTitle /> }));
    expect(container.querySelector('[data-testid="public-page"]')).not.toBeNull();
    mocks.pathname = '/login';
    await act(async () => renderProvider({ children: <RouteTitle /> }));
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="auth-title"]')).toBeNull();
    await act(async () => {
      enLoad.resolve(enMessages);
      await enLoad.promise;
    });
    expect(mocks.loadMessages).toHaveBeenCalledExactlyOnceWith('en');
    expect(container.querySelector('[data-testid="auth-title"]')?.textContent).toBe('Sign In');
  });
  it('keeps an audited public route on the subset without loading a full catalogue', async () => {
    await act(async () =>
      renderProvider({
        children: <PrivacyTitle />,
      }),
    );
    expect(container.querySelector('[data-testid="privacy-title"]')?.textContent).toBe('Loading...');
    mocks.pathname = '/privacy';
    mocks.search = 'lang=ko';
    await act(async () =>
      renderProvider({
        children: <PrivacyTitle />,
      }),
    );
    expect(mocks.loadMessages).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="privacy-title"]')?.textContent).toBe('Loading...');
    mocks.loadMessages.mockResolvedValue(enMessages);
    mocks.pathname = '/works/example';
    mocks.search = 'edit=true';
    await act(async () =>
      renderProvider({
        children: <PrivacyTitle />,
      }),
    );
    expect(mocks.loadMessages).toHaveBeenCalledExactlyOnceWith('en');
  });
  it.each([
    '/posts',
    '/artists',
    '/labels',
    '/releases',
    '/events',
    '/labels/example',
    '/events/example',
    '/series/example',
    '/event-series/example',
    '/privacy/history',
    '/privacy/history/example',
    '/terms/history',
    '/terms/history/example',
  ])('keeps public navigation to %s visible without importing the full catalogue', async (pathname) => {
    await act(async () => renderProvider({ children: <PrivacyTitle /> }));
    mocks.pathname = pathname;
    mocks.search = 'lang=ko';
    await act(async () => renderProvider({ children: <PrivacyTitle /> }));
    expect(mocks.loadMessages).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('[data-testid="privacy-title"]')?.textContent).toBe('Loading...');
  });
  it.each(['share=token', 'preview=example&token=secret'])(
    'keeps legal detail share and preview mode %s on the public catalogue',
    async (search) => {
      await act(async () => renderProvider({ children: <PrivacyTitle /> }));
      mocks.pathname = '/privacy/history/example';
      mocks.search = search;
      await act(async () => renderProvider({ children: <PrivacyTitle /> }));
      expect(mocks.loadMessages).not.toHaveBeenCalled();
      expect(container.querySelector('[data-testid="privacy-title"]')?.textContent).toBe('Loading...');
    },
  );
  it.each(['view=edit', 'view=public&view=edit', 'edit=false&edit=true'])(
    'loads the full catalogue before a legal detail edit mode %s',
    async (search) => {
      const pending = deferred<ClientMessages>();
      mocks.loadMessages.mockReturnValue(pending.promise);
      await act(async () => renderProvider({ children: <PrivacyTitle /> }));
      mocks.pathname = '/privacy/history/example';
      mocks.search = search;
      await act(async () => renderProvider({ children: <PrivacyTitle /> }));
      expect(mocks.loadMessages).toHaveBeenCalledExactlyOnceWith('en');
      expect(container.querySelector('[role="status"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="privacy-title"]')).toBeNull();
    },
  );
  it('prefetches the complete catalogue when idle for a signed-in user without hiding the page', async () => {
    const pending = deferred<ClientMessages>();
    mocks.loadMessages.mockReturnValue(pending.promise);
    mocks.session = { data: { user: { id: 'member' } } };
    const idleCallbacks: Array<() => void> = [];
    const original = { request: window.requestIdleCallback, cancel: window.cancelIdleCallback };
    window.requestIdleCallback = (callback: IdleRequestCallback) =>
      idleCallbacks.push(() => callback({ didTimeout: false, timeRemaining: () => 50 }));
    window.cancelIdleCallback = () => undefined;
    try {
      await act(async () => renderProvider({ children: <PrivacyTitle /> }));
      expect(mocks.loadMessages).not.toHaveBeenCalled();
      await act(async () => idleCallbacks.forEach((callback) => callback()));
      expect(mocks.loadMessages).toHaveBeenCalledExactlyOnceWith('en');
      expect(container.querySelector('[data-testid="privacy-title"]')?.textContent).toBe('Loading...');
      await act(async () => {
        pending.resolve(enMessages);
        await pending.promise;
      });
      mocks.pathname = '/login';
      await act(async () => renderProvider({ children: <AuthTitle /> }));
      expect(container.querySelector('[role="status"]')).toBeNull();
      expect(container.querySelector('[data-testid="auth-title"]')?.textContent).toBe('Sign In');
      expect(mocks.loadMessages).toHaveBeenCalledTimes(1);
    } finally {
      window.requestIdleCallback = original.request;
      window.cancelIdleCallback = original.cancel;
    }
  });
  it('does not prefetch for anonymous visitors', async () => {
    const idle = vi.fn();
    const original = window.requestIdleCallback;
    window.requestIdleCallback = idle;
    try {
      await act(async () => renderProvider({ children: <PrivacyTitle /> }));
      expect(idle).not.toHaveBeenCalled();
      expect(mocks.loadMessages).not.toHaveBeenCalled();
    } finally {
      window.requestIdleCallback = original;
    }
  });
  it('never renders the previous locale full catalogue while the current locale is loading', async () => {
    const enLoad = deferred<ClientMessages>();
    const koLoad = deferred<ClientMessages>();
    mocks.pathname = '/login';
    mocks.loadMessages.mockImplementation((locale: string) => (locale === 'ko' ? koLoad.promise : enLoad.promise));
    await act(async () => renderProvider());
    expect(mocks.loadMessages).toHaveBeenCalledWith('en');
    await act(async () =>
      renderProvider({
        locale: 'ko',
        messages: publicMessages,
      }),
    );
    expect(mocks.loadMessages).toHaveBeenCalledWith('ko');
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="auth-title"]')).toBeNull();
    await act(async () => {
      enLoad.resolve(enMessages);
      await enLoad.promise;
    });
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Sign In');
    await act(async () => {
      koLoad.resolve(koMessages);
      await koLoad.promise;
    });
    expect(container.querySelector('[data-testid="auth-title"]')?.textContent).toBe('로그인');
  });
  it('keeps public detail navigation reduced and restores the selected locale before editing', async () => {
    const koPublicMessages = selectClientMessages(koMessages, { pathWithSearch: '/posts/example?lang=ko' });
    const koLoad = deferred<ClientMessages>();
    mocks.loadMessages.mockReturnValue(koLoad.promise);
    mocks.pathname = '/posts/example';
    mocks.search = 'lang=ko';
    await act(async () => renderProvider({ locale: 'ko', messages: koPublicMessages, children: <PrivacyTitle /> }));
    for (const pathname of ['/works/example', '/releases/example', '/artists/example']) {
      mocks.pathname = pathname;
      await act(async () => renderProvider({ locale: 'ko', messages: koPublicMessages, children: <PrivacyTitle /> }));
      expect(container.querySelector('[role="status"]')).toBeNull();
    }
    expect(mocks.loadMessages).not.toHaveBeenCalled();
    mocks.search = 'lang=ko&edit=true';
    await act(async () => renderProvider({ locale: 'ko', messages: koPublicMessages }));
    expect(mocks.loadMessages).toHaveBeenCalledExactlyOnceWith('ko');
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="auth-title"]')).toBeNull();
    await act(async () => {
      koLoad.resolve(koMessages);
      await koLoad.promise;
    });
    expect(container.querySelector('[data-testid="auth-title"]')?.textContent).toBe('로그인');
  });
  it.each(['en', 'ko'] as const)(
    'keeps failed-route children hidden and offers a localized catalogue retry (%s)',
    async (locale) => {
      const expectedMessages = locale === 'ko' ? koMessages : enMessages;
      mocks.pathname = '/login';
      mocks.loadMessages.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(expectedMessages);
      await act(async () =>
        renderProvider({
          locale,
          messages: selectClientMessages(expectedMessages, { pathWithSearch: '/' }),
        }),
      );
      await act(async () => Promise.resolve());
      expect(container.querySelectorAll('[role="alert"]')).toHaveLength(1);
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(expectedMessages.common.errors.generic);
      const retryButton = container.querySelector('button');
      expect(retryButton?.getAttribute('data-control-kind')).toBe('button');
      expect(retryButton?.getAttribute('data-tone')).toBe('neutral');
      expect(retryButton?.getAttribute('data-emphasis')).toBe('medium');
      expect(retryButton?.textContent).toBe(expectedMessages.common.actions.tryAgain);
      expect(document.documentElement.getAttribute('data-geul-theme')).toBe('dark');
      expect(container.querySelector('[data-testid="auth-title"]')).toBeNull();
      await act(async () => {
        container.querySelector('button')?.click();
        await Promise.resolve();
      });
      expect(mocks.loadMessages).toHaveBeenCalledTimes(2);
      expect(container.querySelector('[data-testid="auth-title"]')?.textContent).toBe(
        expectedMessages.auth.login.title,
      );
    },
  );
  it('prefers fresh server full messages over a previously loaded catalogue', async () => {
    mocks.pathname = '/login';
    mocks.loadMessages.mockResolvedValue(enMessages);
    await act(async () => renderProvider());
    expect(container.querySelector('[data-testid="auth-title"]')?.textContent).toBe('Sign In');
    const freshMessages: ClientMessages = {
      ...enMessages,
      auth: {
        ...enMessages.auth,
        login: { ...enMessages.auth.login, title: 'Fresh server message' },
      },
    };
    await act(async () => renderProvider({ messages: freshMessages, messageCoverage: 'all' }));
    expect(container.querySelector('[data-testid="auth-title"]')?.textContent).toBe('Fresh server message');
  });
  it('server-renders public subsets and keeps an initially full unknown route usable', () => {
    mocks.pathname = '/privacy';
    const publicMarkup = renderToStaticMarkup(
      <DesignSystemProvider defaultColorScheme="dark">
        <ClientMessagesProvider locale="en" messages={publicMessages} messageCoverage={PUBLIC_COVERAGE}>
          <PrivacyTitle />
        </ClientMessagesProvider>
      </DesignSystemProvider>,
    );
    expect(publicMarkup).toContain('Loading...');
    mocks.pathname = '/login';
    const fullMarkup = renderToStaticMarkup(
      <DesignSystemProvider defaultColorScheme="dark">
        <ClientMessagesProvider locale="en" messages={enMessages} messageCoverage="all">
          <AuthTitle />
        </ClientMessagesProvider>
      </DesignSystemProvider>,
    );
    expect(fullMarkup).toContain('Sign In');
    expect(mocks.loadMessages).not.toHaveBeenCalled();
  });
});
