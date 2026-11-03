// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { useTranslations } from 'next-intl';
import { TestProviders } from '@/test/TestProviders';
import { clientMessageCoverage, selectClientMessages } from '@/lib/i18n/client-messages';
import { getMessagesForLocale } from '@/lib/i18n/messages';
import { ClientMessagesProvider } from './ClientMessagesProvider';

const mocks = vi.hoisted(() => ({ pathname: '/', loadMessages: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/providers/SessionProvider', () => ({ useSessionContext: () => null }));
vi.mock('@/lib/i18n/client-message-loaders', () => ({ loadClientMessagesForLocale: mocks.loadMessages }));
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

function AuthTitle() {
  return <span>{useTranslations('auth.login')('title')}</span>;
}
function PublicTitle() {
  return <span>{useTranslations('common.states')('loading')}</span>;
}
beforeEach(() => mocks.loadMessages.mockReset());

it.each([undefined, 'https://cdn.example.com/loader.gif?version=2'])(
  'server-renders visible localized pending text with root image %s before ManifestProvider exists',
  async (image) => {
    mocks.pathname = '/login';
    const messages = await getMessagesForLocale('ko');
    const markup = renderToStaticMarkup(
      <TestProviders locale="ko">
        <ClientMessagesProvider
          locale="ko"
          messages={selectClientMessages(messages, { pathWithSearch: '/' })}
          messageCoverage={clientMessageCoverage('/')}
          loaderImageSrc={image}
          loaderImageUnoptimized
        >
          <AuthTitle />
        </ClientMessagesProvider>
      </TestProviders>,
    );
    if (image) {
      expect(markup).toContain(image);
    } else {
      expect(markup).not.toContain('<img');
    }
    expect(markup).not.toContain('rel="preload"');
    expect(markup).toContain(`aria-label="${messages.common.states.loading}"`);
    if (image) {
      expect(markup).toContain('data-unoptimized="true"');
      expect(markup).toContain('data-preload="undefined"');
    }
    expect(markup).not.toMatch(/>[^<]*로그인[^<]*</);
    // The loading phrase is visible element text, not only the status name.
    expect(markup).toContain(`>${messages.common.states.loading}</`);
  },
);

it('server-renders public subsets and keeps an initially full unknown route usable', async () => {
  const messages = await getMessagesForLocale('en');
  mocks.pathname = '/privacy';
  const publicMarkup = renderToStaticMarkup(
    <TestProviders>
      <ClientMessagesProvider
        locale="en"
        messages={selectClientMessages(messages, { pathWithSearch: '/' })}
        messageCoverage={clientMessageCoverage('/')}
      >
        <PublicTitle />
      </ClientMessagesProvider>
    </TestProviders>,
  );
  expect(publicMarkup).toContain('Loading...');
  mocks.pathname = '/login';
  const fullMarkup = renderToStaticMarkup(
    <TestProviders>
      <ClientMessagesProvider locale="en" messages={messages} messageCoverage="all">
        <AuthTitle />
      </ClientMessagesProvider>
    </TestProviders>,
  );
  expect(fullMarkup).toContain('Sign In');
  expect(mocks.loadMessages).not.toHaveBeenCalled();
});
