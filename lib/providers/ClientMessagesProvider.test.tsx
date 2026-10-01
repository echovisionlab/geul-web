// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { selectClientMessages, type ClientMessages } from '@/lib/i18n/client-messages';
import { getMessagesForLocale } from '@/lib/i18n/messages';
import { ClientMessagesProvider } from './ClientMessagesProvider';

const mocks = vi.hoisted(() => ({
  loadMessages: vi.fn(),
  pathname: '/',
  search: '',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock('@/lib/i18n/client-message-loaders', () => ({
  loadClientMessagesForLocale: mocks.loadMessages,
}));

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
  reducedCatalogue = true,
  children = <AuthTitle />,
}: {
  locale?: string;
  messages?: Partial<ClientMessages>;
  reducedCatalogue?: boolean;
  children?: ReactNode;
} = {}) {
  root.render(
    <ClientMessagesProvider locale={locale} messages={messages} reducedCatalogue={reducedCatalogue}>
      {children}
    </ClientMessagesProvider>,
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
  publicMessages = selectClientMessages(enMessages, { pathWithSearch: '/', hasSession: false });
  mocks.pathname = '/';
  mocks.search = '';
  mocks.loadMessages.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ClientMessagesProvider', () => {
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
    mocks.pathname = '/works';
    mocks.search = 'edit=true';
    await act(async () =>
      renderProvider({
        children: <PrivacyTitle />,
      }),
    );
    expect(mocks.loadMessages).toHaveBeenCalledExactlyOnceWith('en');
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

  it('keeps failed-route children hidden and offers a working catalogue retry', async () => {
    mocks.pathname = '/login';
    mocks.loadMessages.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(enMessages);

    await act(async () => renderProvider());
    await act(async () => Promise.resolve());

    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="auth-title"]')).toBeNull();

    await act(async () => {
      container.querySelector('button')?.click();
      await Promise.resolve();
    });

    expect(mocks.loadMessages).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="auth-title"]')?.textContent).toBe('Sign In');
  });

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
    await act(async () => renderProvider({ messages: freshMessages, reducedCatalogue: false }));

    expect(container.querySelector('[data-testid="auth-title"]')?.textContent).toBe('Fresh server message');
  });

  it('server-renders public subsets and keeps an initially full unknown route usable', () => {
    mocks.pathname = '/privacy';
    const publicMarkup = renderToStaticMarkup(
      <ClientMessagesProvider locale="en" messages={publicMessages} reducedCatalogue>
        <PrivacyTitle />
      </ClientMessagesProvider>,
    );
    expect(publicMarkup).toContain('Loading...');

    mocks.pathname = '/login';
    const fullMarkup = renderToStaticMarkup(
      <ClientMessagesProvider locale="en" messages={enMessages} reducedCatalogue={false}>
        <AuthTitle />
      </ClientMessagesProvider>,
    );
    expect(fullMarkup).toContain('Sign In');
    expect(mocks.loadMessages).not.toHaveBeenCalled();
  });
});
