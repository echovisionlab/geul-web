// @vitest-environment jsdom

import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, configure, getConfig, render, screen, userEvent, within } from '@/test/render';
import { onDemandModule, type OnDemandModule } from '@/components/core/on-demand-module';
import { ShellMobileNavigation } from './ShellMobileNavigation';
import { ShellView, type ShellViewProps } from './ShellView';

type NavigationModule = typeof import('./ShellMobileNavigation');
const boundary = vi.hoisted(() => ({ current: null as OnDemandModule<NavigationModule> | null }));

// Only the chunk boundary is controlled; the Core hook, controls and Shell frame run together.
vi.mock('./shell-mobile-navigation-module', () => ({
  mobileNavigation: {
    load: () => boundary.current!.load(),
    preload: () => boundary.current!.preload(),
    peek: () => boundary.current!.peek(),
  },
}));

const fixture: Omit<ShellViewProps, 'navigationOpened'> = {
  children: <button type="button">Page action</button>,
  loginHref: '/login',
  userMenuOpened: false,
  themeMode: 'light',
  user: null,
  headerItems: [{ id: 'about', label: 'About', href: '/about', active: false, openInNewTab: false, children: [] }],
  secondaryItems: [],
  footerItems: [],
  accountItems: [],
  footer: {
    siteTitle: 'Studio',
    description: null,
    copyright: null,
    taxId: null,
    companyAddress: null,
    version: 'Preview',
    showChangelog: false,
  },
  labels: {
    navigation: 'Studio navigation',
    toggleNavigation: 'Toggle navigation',
    navigationLoadFailed: '탐색 메뉴를 불러오지 못했습니다.',
    retryNavigation: '다시 시도',
    close: 'Close',
    search: 'Search',
    searchTooltip: 'Search',
    signIn: 'Sign in',
    account: 'Account',
    logOut: 'Sign out',
    toggleColorScheme: 'Theme',
    themeTooltip: 'Theme',
    cookieSettings: 'Cookie settings',
    changelog: 'Changelog',
    newsletter: 'Newsletter',
    footerSiteInfo: 'Site information',
    footerLinks: 'Links',
    footerSocialMedia: 'Social media',
  },
  events: {
    onToggleNavigation: () => {},
    onOpenUserMenu: () => {},
    onCloseUserMenu: () => {},
    onSearch: () => {},
    onToggleColorScheme: () => {},
    onSignOut: () => {},
    onOpenCookieSettings: () => {},
    onNavigate: () => {},
  },
  slots: {
    logo: 'Studio',
    printHeader: null,
    printWatermark: null,
    languageDesktop: null,
    languageNavigation: null,
    languageFooterDesktop: null,
    languageFooterMobile: null,
    socialLinks: null,
  },
};

function Consumer() {
  const [navigationOpened, setNavigationOpened] = useState(false);
  return (
    <ShellView
      {...fixture}
      navigationOpened={navigationOpened}
      events={{
        ...fixture.events,
        onToggleNavigation: () => setNavigationOpened((opened) => !opened),
      }}
    />
  );
}

const defaultAsyncWrapper = getConfig().asyncWrapper;
beforeEach(() => {
  vi.useFakeTimers();
  // RTL's default wrapper drains a real zero-delay timer; keep interactions inside act under Vitest time.
  configure({
    asyncWrapper: async <T,>(callback: () => Promise<T>): Promise<T> => {
      let result!: T;
      await act(async () => {
        result = await callback();
      });
      return result;
    },
  });
});
afterEach(() => {
  configure({ asyncWrapper: defaultAsyncWrapper });
  vi.useRealTimers();
});

async function openFailingNavigation() {
  const first = Promise.withResolvers<NavigationModule>();
  const loader = vi.fn(() => first.promise);
  boundary.current = onDemandModule(loader);
  render(<Consumer />);
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
  await user.click(toggle);
  expect(toggle).toHaveFocus();
  expect(toggle).toHaveAttribute('aria-busy', 'true');
  const error = new Error('Chunk unavailable');
  loader.mockRejectedValue(error);
  await act(async () => first.reject(error));
  return { user, toggle, loader };
}

async function exhaustRetries() {
  for (const delay of [500, 2000, 5000]) {
    await act(() => vi.advanceTimersByTimeAsync(delay));
  }
}

it('ends exhausted loading with localized recovery and retries the same open navigation', async () => {
  const { user, toggle, loader } = await openFailingNavigation();
  await exhaustRetries();
  expect(screen.getByRole('alert')).toHaveTextContent(fixture.labels.navigationLoadFailed);
  expect(toggle).not.toHaveAttribute('aria-busy', 'true');
  expect(toggle).not.toHaveAttribute('aria-disabled', 'true');
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(toggle).toHaveAttribute('aria-controls', 'shell-mobile-navigation');
  expect(toggle).toHaveFocus();
  await act(() => vi.advanceTimersByTimeAsync(30_000));
  expect(loader).toHaveBeenCalledTimes(4);

  const recovery = Promise.withResolvers<NavigationModule>();
  loader.mockReturnValue(recovery.promise);
  await user.click(screen.getByRole('button', { name: fixture.labels.retryNavigation }));
  expect(toggle).toHaveFocus();
  expect(toggle).toHaveAttribute('aria-busy', 'true');
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(loader).toHaveBeenCalledTimes(5);
  await act(async () => recovery.resolve({ ShellMobileNavigation }));
  const navigation = screen
    .getAllByRole('navigation', { name: 'Studio navigation' })
    .find((region) => region.id === toggle.getAttribute('aria-controls'))!;
  expect(navigation).toHaveAttribute('id', 'shell-mobile-navigation');
  expect(within(navigation).getByRole('link', { name: 'About' })).toBeVisible();
  expect(toggle).not.toHaveAttribute('aria-busy', 'true');
  expect(toggle).toHaveFocus();
});

it.each(['Escape', 'outside pointer', 'outside focus'] as const)(
  'cancels pending and terminal navigation through %s',
  async (action) => {
    const { user, toggle, loader } = await openFailingNavigation();
    const cancel = async () => {
      if (action === 'Escape') {
        await user.keyboard('{Escape}');
      } else if (action === 'outside pointer') {
        await user.click(screen.getByRole('button', { name: 'Page action' }));
      } else {
        act(() => screen.getByRole('button', { name: 'Page action' }).focus());
      }
    };
    await cancel();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).not.toHaveAttribute('aria-busy', 'true');
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(loader).toHaveBeenCalledTimes(1);
    await user.click(toggle);
    await act(() => vi.advanceTimersByTimeAsync(0));
    await exhaustRetries();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await cancel();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    if (action === 'Escape') {
      expect(toggle).toHaveFocus();
    }
  },
);
