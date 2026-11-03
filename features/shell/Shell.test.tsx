// @vitest-environment jsdom

import { type ReactElement, type ReactNode } from 'react';
import { act, render, screen, waitFor } from '@/test/render';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { within } from 'storybook/test';
import type { ShellLayoutProps, ShellState } from './ui/Shell';

const mocks = vi.hoisted(() => ({
  pathname: '/work',
  search: '',
  signOut: vi.fn(),
  settled: true,
  settle: vi.fn(),
  confirm: vi.fn(),
  toggleColorScheme: vi.fn(),
  openSearch: vi.fn(),
  preloadSearch: vi.fn(),
  session: { data: null as unknown, isPending: false },
  state: null as ShellState | null,
}));

vi.mock('@/lib/providers/DesignSystemProvider', async () => ({
  ...(await vi.importActual<typeof import('@/lib/providers/DesignSystemProvider')>(
    '@/lib/providers/DesignSystemProvider',
  )),
  useColorScheme: () => ({ toggleColorScheme: mocks.toggleColorScheme }),
  useComputedColorScheme: () => 'light',
}));
vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock('@mantine/hooks', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    useDisclosure: () => {
      const [opened, setOpened] = React.useState(false);
      const handlers = React.useMemo(
        () => ({
          close: () => setOpened(false),
          open: () => setOpened(true),
          toggle: () => setOpened((current) => !current),
        }),
        [],
      );
      return [opened, handlers] as const;
    },
    useMounted: () => true,
    useOs: () => 'macos',
  };
});
vi.mock('@/features/post/PostSpotlight/post-spotlight-trigger', () => ({
  openPostSpotlight: mocks.openSearch,
  preloadPostSpotlight: mocks.preloadSearch,
}));
vi.mock('@/lib/editor/settle-edits-before-sign-out', () => ({
  settleEditsBeforeSignOut: mocks.settle,
}));
vi.mock('@/features/confirmation/confirmation-dialogs', () => ({
  confirmationDialogs: { open: mocks.confirm },
}));
vi.mock('@/lib/auth/client', () => ({
  signOut: mocks.signOut,
  useSession: () => mocks.session,
}));
vi.mock('@/lib/utils/managed-image-url', () => ({
  buildManagedImageUrl: (image: string | null) => image,
  MANAGED_IMAGE_PRESET: { AVATAR_MD: 'md', AVATAR_SM: 'sm', AVATAR_XS: 'xs' },
}));

// Server composition dependencies.
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => (key: string, values?: Record<string, string>) =>
    values?.shortcut ? `${namespace}.${key}:${values.shortcut}` : `${namespace}.${key}`,
}));
vi.mock('@/lib/utils/language.server', () => ({ getRequestLocaleContext: async () => ({ locale: 'en' }) }));
vi.mock('@/lib/queries/manifest', () => ({
  getManifest: vi.fn(async () => ({
    settings: {
      site_title: 'Example Studio',
      company_name: 'Example Company',
      meta_description: 'Independent publishing.',
      tax_id: '123-45-67890',
      company_address: '',
      social_links: { instagram: 'https://instagram.com/example' },
    },
    menus: {
      header: [{ id: 'about', label: 'About', url: '/about', openInNewTab: false, children: [] }],
      secondary: [],
      footer: [{ id: 'privacy', label: 'Privacy', url: '/privacy', openInNewTab: true, children: [] }],
      avatarDropdown: [{ id: 'profile', label: 'Profile', url: '/my/profile', children: [] }],
    },
  })),
}));
vi.mock('@/lib/utils/menu', () => ({
  isMenuUrlActive: (pathname: string, href: string) => pathname === href,
  resolveMenuUrl: (item: { url?: string }) => item.url ?? '/',
}));
vi.mock('@/lib/site-version', () => ({ APP_VERSION_LABEL: 'v-test' }));
vi.mock('./LanguageMenu', () => ({ LanguageMenu: () => null }));
vi.mock('@/features/shell/PrintHeader', () => ({ PrintHeader: () => null }));
vi.mock('@/features/site/SiteLogo', () => ({ SiteLogo: () => null }));

import { useShellState } from './ui/Shell/shell-state';
import { Shell } from './Shell';
import { getManifest } from '@/lib/queries/manifest';
import { siteVariableManifest } from '@/features/editor/tiptap/site-variables/site-variable.story-fixtures';
import { siteVariableHrefCases } from '@/test/site-variable-link';
import { ShellRuntime } from './ShellRuntime';
import { ShellSearchAction } from './ui/Shell/ShellIslands';

const labels = {
  navigationLoadFailed: 'Could not load navigation.',
  retryNavigation: 'Retry navigation',
  searchTooltipMac: 'Search (Cmd+K)',
  searchTooltipOther: 'Search (Ctrl+K)',
  lightMode: 'Light mode',
  darkMode: 'Dark mode',
  toggleColorScheme: 'Toggle color scheme',
  signOutUnsavedTitle: 'Sign out with unsaved edits?',
  signOutUnsavedMessage: 'Signing out deletes them from this device.',
  signOutUnsavedConfirm: 'Sign out and discard',
  cancel: 'Cancel',
  close: 'Close',
};

function Probe() {
  mocks.state = useShellState();
  return null;
}

let view: ReturnType<typeof render> | null = null;

beforeEach(() => {
  view = null;
  mocks.settle.mockReset().mockImplementation(async () => mocks.settled);
  mocks.pathname = '/work';
  mocks.search = '';
  mocks.state = null;
  mocks.session = { data: null, isPending: false };
  mocks.signOut.mockReset();
  mocks.openSearch.mockReset();
  mocks.preloadSearch.mockReset();
});

function renderRuntime(children: ReactNode = <Probe />) {
  const element = (
    <ShellRuntime labels={labels} initialUserSnapshot={{ name: 'June', image: null }}>
      {children}
    </ShellRuntime>
  );
  // This controller-only fixture supplies no Core views; the server composition cases render them below.
  if (view) {
    view.rerender(element);
  } else {
    view = render(element);
  }
}

function state() {
  expect(mocks.state).not.toBeNull();
  return mocks.state!;
}

describe('ShellRuntime client state', () => {
  it('keeps public page query context in the login return path and advertises the K shortcut', () => {
    mocks.search = 'share=share-token&lang=ko&table_page=3';
    renderRuntime();

    expect(state().loginHref).toBe('/login?redirect=%2Fwork%3Fshare%3Dshare-token%26lang%3Dko%26table_page%3D3');
    expect(state().labels.searchTooltip).toBe('Search (Cmd+K)');
    expect(state().labels.themeTooltip).toBe('Dark mode');
    expect(state().labels.navigationLoadFailed).toBe(labels.navigationLoadFailed);
    expect(state().labels.retryNavigation).toBe(labels.retryNavigation);
    state().events.onSearchIntent?.();
    expect(mocks.preloadSearch).toHaveBeenCalledTimes(1);
    state().events.onSearch();
    expect(mocks.openSearch).toHaveBeenCalledTimes(1);
  });

  it('tracks a search-launch promise on the real trigger without duplicating activation', async () => {
    let finish!: () => void;
    mocks.openSearch.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    renderRuntime(
      <>
        <Probe />
        <ShellSearchAction label="Search" variant="mobile" />
      </>,
    );
    await view!.user.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByRole('button', { name: 'Search' })).toHaveAttribute('aria-busy', 'true');
    await view!.user.click(screen.getByRole('button', { name: 'Search' }));
    expect(mocks.openSearch).toHaveBeenCalledOnce();
    await act(async () => finish());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Search' })).not.toHaveAttribute('aria-busy', 'true'),
    );
  });

  it('owns navigation and account state and closes both when navigation completes', () => {
    renderRuntime();
    expect(state()).toMatchObject({ navigationOpened: false, userMenuOpened: false });

    act(() => state().events.onToggleNavigation());
    expect(state().navigationOpened).toBe(true);

    act(() => state().events.onOpenUserMenu());
    expect(state().userMenuOpened).toBe(true);

    act(() => state().events.onCloseUserMenu());
    expect(state().userMenuOpened).toBe(false);

    act(() => state().events.onOpenUserMenu());
    expect(state().userMenuOpened).toBe(true);

    act(() => state().events.onNavigate('/my/profile'));
    expect(state()).toMatchObject({ navigationOpened: false, userMenuOpened: false });
  });

  it('closes mobile navigation when the active route changes and derives the current menu item', () => {
    renderRuntime();
    act(() => state().events.onToggleNavigation());
    expect(state().navigationOpened).toBe(true);
    const about = { id: 'about', label: 'About', href: '/about', active: false, openInNewTab: false, children: [] };
    expect(state().isItemActive(about)).toBe(false);

    mocks.pathname = '/about';
    renderRuntime();
    expect(state().navigationOpened).toBe(false);
    expect(state().isItemActive(about)).toBe(true);
  });

  it('hands logout to the full-page auth redirect once every edit is saved', async () => {
    mocks.settled = true;
    mocks.signOut.mockClear();
    renderRuntime();
    act(() => state().events.onOpenUserMenu());
    expect(state().userMenuOpened).toBe(true);

    await act(async () => state().events.onSignOut());

    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(state().userMenuOpened).toBe(false);
  });

  it('asks before signing out would delete unsaved edits from this device', async () => {
    mocks.settled = false;
    mocks.signOut.mockClear();
    mocks.confirm.mockClear();
    renderRuntime();

    await act(async () => state().events.onSignOut());

    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'discard', title: labels.signOutUnsavedTitle, onConfirm: mocks.signOut }),
    );
    mocks.settled = true;
  });

  it('keeps sign-out pending through edit settlement and the auth redirect, and deduplicates activation', async () => {
    let finishEdits!: (settled: boolean) => void;
    let finishSignOut!: () => void;
    mocks.settle.mockReturnValue(
      new Promise<boolean>((resolve) => {
        finishEdits = resolve;
      }),
    );
    mocks.signOut.mockReturnValue(
      new Promise<void>((resolve) => {
        finishSignOut = resolve;
      }),
    );
    renderRuntime();
    let task!: void | Promise<void>;
    act(() => {
      task = state().events.onSignOut();
      void state().events.onSignOut();
    });
    expect(state().signOutPending).toBe(true);
    expect(mocks.settle).toHaveBeenCalledOnce();
    await act(async () => finishEdits(true));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
    expect(state().signOutPending).toBe(true);
    await act(async () => {
      finishSignOut();
      await task;
    });
    expect(state().signOutPending).toBe(false);
  });

  it('does not open a stale discard confirmation after unmount', async () => {
    let finish!: (settled: boolean) => void;
    mocks.confirm.mockClear();
    mocks.settle.mockReturnValue(
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
    );
    renderRuntime();
    act(() => {
      void state().events.onSignOut();
    });
    view!.unmount();
    await act(async () => finish(false));
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('shows the cookie snapshot while the session resolves, then the session user and role-gated links', () => {
    mocks.session = { data: null, isPending: true };
    renderRuntime();
    expect(state().user).toMatchObject({ kind: 'snapshot', name: 'June' });
    expect(state().showChangelog).toBe(false);

    mocks.session = {
      data: { onboarded: true, user: { nickname: 'June Han', email: 'june@example.com', image: null, role: 'author' } },
      isPending: false,
    };
    renderRuntime();
    expect(state().user).toMatchObject({ kind: 'authenticated', name: 'June Han', email: 'june@example.com' });
    expect(state().showChangelog).toBe(true);
  });
});

describe('Shell server composition', () => {
  it('renders the manifest menus, translated labels and business footer on the server', async () => {
    const shell = await Shell({ children: <main>Page</main>, initialUserSnapshot: null });
    expect(shell.props.labels).toMatchObject({
      navigationLoadFailed: 'common.messages.failedToLoad',
      retryNavigation: 'common.loadMore.retry',
    });
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(shell);
    const page = within(host);

    const about = page.getAllByRole('link', { name: 'About' });
    expect(about.length).toBeGreaterThan(0);
    for (const link of about) {
      expect(link.getAttribute('href')).toBe('/about');
    }
    expect(page.getAllByRole('button', { name: 'shell.actions.search' }).length).toBeGreaterThan(0);

    const footer = page.getByRole('contentinfo');
    expect(footer.textContent).toContain('Example Studio');
    expect(footer.textContent).toContain('Independent publishing.');
    expect(footer.textContent).toContain(`© ${new Date().getFullYear()} Example Company`);
    expect(footer.textContent).toContain('123-45-67890');
    expect(footer.textContent).toContain('v-test');
    const privacy = within(footer).getAllByRole('link', { name: 'Privacy' });
    expect(privacy.length).toBeGreaterThan(0);
    for (const link of privacy) {
      expect(link.getAttribute('href')).toBe('/privacy');
      expect(link.getAttribute('target')).toBe('_blank');
    }
    const instagram = within(footer).getAllByRole('link', { name: /instagram/i });
    expect(instagram.length).toBeGreaterThan(0);
    for (const link of instagram) {
      expect(link.getAttribute('href')).toBe('https://instagram.com/example');
    }
  });
});

describe('authored shell destinations', () => {
  it.each(siteVariableHrefCases.filter(({ name }) => name === 'contact email' || name === 'unsafe scheme'))(
    'projects every menu href once: $name',
    async ({ source, expected, settings }) => {
      const manifest = { ...siteVariableManifest, settings: { ...siteVariableManifest.settings, ...settings } };
      const item = { id: 'contact', label: 'Contact', url: source, children: [] };
      const parent = { ...item, id: 'parent', url: '/', children: [item] };
      vi.mocked(getManifest).mockResolvedValueOnce({
        ...manifest,
        menus: {
          ...manifest.menus,
          header: [parent],
          secondary: [item],
          footer: [item],
          avatarDropdown: [item],
        },
      } as unknown as Awaited<ReturnType<typeof getManifest>>);
      const element = (await Shell({ children: null })) as ReactElement<{ children: ReactElement<ShellLayoutProps> }>;
      const layout = element.props.children.props;
      expect(layout.headerItems[0].children[0].href).toBe(expected ?? '');
      expect(layout.secondaryItems[0].href).toBe(expected ?? '');
      expect(layout.footerItems[0].href).toBe(expected ?? '');
      expect(layout.accountItems[0].href).toBe(expected ?? '');
    },
  );
});
