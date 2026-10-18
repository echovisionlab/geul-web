// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { render, screen, type RenderResult } from '@/test/render';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DesignSystemProvider } from './DesignSystemProvider';
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
const PUBLIC_COVERAGE = clientMessageCoverage('/');
let publicMessages: Partial<ClientMessages>;
let enMessages: ClientMessages;
let koMessages: ClientMessages;
function AuthTitle() {
  const t = useTranslations('auth.login');
  return <span data-testid="auth-title">{t('title')}</span>;
}
function PrivacyTitle() {
  const t = useTranslations('common.states');
  return <span data-testid="privacy-title">{t('loading')}</span>;
}
function RouteTitle() {
  return usePathname() === '/login' ? <AuthTitle /> : <span data-testid="public-page">Public page</span>;
}
let view: (RenderResult & { user: ReturnType<typeof render>['user'] }) | undefined;
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
  const tree = (
    <DesignSystemProvider forceColorScheme="dark">
      <ClientMessagesProvider
        locale={locale}
        messages={messages}
        messageCoverage={messageCoverage}
        loaderImageSrc={loaderImageSrc}
        loaderImageUnoptimized={loaderImageUnoptimized}
      >
        {children}
      </ClientMessagesProvider>
    </DesignSystemProvider>
  );
  if (view) {
    view.rerender(tree);
  } else {
    view = render(tree);
  }
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
  view = undefined;
});
afterEach(() => {
  view?.unmount();
});
describe('ClientMessagesProvider', () => {
  it('uses a quiet accessible pending surface for empty configuration and ignores a cancelled catalogue load', async () => {
    const pending = deferred<ClientMessages>();
    mocks.pathname = '/login';
    mocks.loadMessages.mockReturnValue(pending.promise);
    await act(async () => renderProvider());
    expect(screen.queryByRole('status')?.textContent).toBe('');
    expect(document.documentElement).toHaveAttribute('data-geul-theme', 'dark');
    expect(screen.queryByRole('img')).toBeNull();

    mocks.pathname = '/';
    await act(async () => renderProvider({ children: <RouteTitle /> }));
    await act(async () => {
      pending.resolve(enMessages);
      await pending.promise;
    });
    expect(screen.getByTestId('public-page')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('loads the full catalogue before showing private messages after public-to-login navigation', async () => {
    const enLoad = deferred<ClientMessages>();
    mocks.loadMessages.mockReturnValue(enLoad.promise);
    await act(async () => renderProvider({ children: <RouteTitle /> }));
    expect(screen.getByTestId('public-page')).toBeInTheDocument();
    mocks.pathname = '/login';
    await act(async () => renderProvider({ children: <RouteTitle /> }));
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('auth-title')).toBeNull();
    await act(async () => {
      enLoad.resolve(enMessages);
      await enLoad.promise;
    });
    expect(mocks.loadMessages).toHaveBeenCalledExactlyOnceWith('en');
    expect(screen.queryByTestId('auth-title')?.textContent).toBe('Sign In');
  });
  it('keeps an audited public route on the subset without loading a full catalogue', async () => {
    await act(async () =>
      renderProvider({
        children: <PrivacyTitle />,
      }),
    );
    expect(screen.queryByTestId('privacy-title')?.textContent).toBe('Loading...');
    mocks.pathname = '/privacy';
    mocks.search = 'lang=ko';
    await act(async () =>
      renderProvider({
        children: <PrivacyTitle />,
      }),
    );
    expect(mocks.loadMessages).not.toHaveBeenCalled();
    expect(screen.queryByTestId('privacy-title')?.textContent).toBe('Loading...');
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
      expect(screen.queryByTestId('privacy-title')?.textContent).toBe('Loading...');
      await act(async () => {
        pending.resolve(enMessages);
        await pending.promise;
      });
      mocks.pathname = '/login';
      await act(async () => renderProvider({ children: <AuthTitle /> }));
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByTestId('auth-title')?.textContent).toBe('Sign In');
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
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('auth-title')).toBeNull();
    await act(async () => {
      enLoad.resolve(enMessages);
      await enLoad.promise;
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Sign In');
    await act(async () => {
      koLoad.resolve(koMessages);
      await koLoad.promise;
    });
    expect(screen.queryByTestId('auth-title')?.textContent).toBe('로그인');
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
      expect(screen.queryAllByRole('alert')).toHaveLength(1);
      expect(screen.queryByRole('alert')?.textContent).toContain(expectedMessages.common.errors.generic);
      const retryButton = screen.queryByRole('button');
      expect(retryButton?.getAttribute('data-control-kind')).toBe('button');
      expect(retryButton?.getAttribute('data-tone')).toBe('neutral');
      expect(retryButton?.getAttribute('data-emphasis')).toBe('medium');
      expect(retryButton?.textContent).toBe(expectedMessages.common.actions.tryAgain);
      expect(document.documentElement.getAttribute('data-geul-theme')).toBe('dark');
      expect(screen.queryByTestId('auth-title')).toBeNull();
      await view!.user.click(screen.getByRole('button', { name: expectedMessages.common.actions.tryAgain }));
      expect(mocks.loadMessages).toHaveBeenCalledTimes(2);
      expect(screen.queryByTestId('auth-title')?.textContent).toBe(expectedMessages.auth.login.title);
    },
  );
  it('prefers fresh server full messages over a previously loaded catalogue', async () => {
    mocks.pathname = '/login';
    mocks.loadMessages.mockResolvedValue(enMessages);
    await act(async () => renderProvider());
    expect(screen.queryByTestId('auth-title')?.textContent).toBe('Sign In');
    const freshMessages: ClientMessages = {
      ...enMessages,
      auth: {
        ...enMessages.auth,
        login: { ...enMessages.auth.login, title: 'Fresh server message' },
      },
    };
    await act(async () => renderProvider({ messages: freshMessages, messageCoverage: 'all' }));
    expect(screen.queryByTestId('auth-title')?.textContent).toBe('Fresh server message');
  });
});
