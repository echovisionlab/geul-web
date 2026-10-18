// @vitest-environment jsdom

import { act, type ReactElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { within } from 'storybook/test';
import type { ShellLayoutProps, ShellState } from './ui/Shell';

const mocks = vi.hoisted(() => ({
  pathname: '/work',
  search: '',
  signOut: vi.fn(),
  settled: true,
  confirm: vi.fn(),
  toggleColorScheme: vi.fn(),
  openSearch: vi.fn(),
  preloadSearch: vi.fn(),
  session: { data: null as unknown, isPending: false },
  state: null as ShellState | null,
}));

vi.mock('@/lib/providers/DesignSystemProvider', () => ({
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
  settleEditsBeforeSignOut: async () => mocks.settled,
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

const labels = {
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

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.pathname = '/work';
  mocks.search = '';
  mocks.state = null;
  mocks.session = { data: null, isPending: false };
  mocks.signOut.mockReset();
  mocks.openSearch.mockReset();
  mocks.preloadSearch.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderRuntime(children: ReactNode = <Probe />) {
  act(() => {
    root.render(
      <ShellRuntime labels={labels} initialUserSnapshot={{ name: 'June', image: null }}>
        {children}
      </ShellRuntime>,
    );
  });
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
    state().events.onSearchIntent?.();
    expect(mocks.preloadSearch).toHaveBeenCalledTimes(1);
    state().events.onSearch();
    expect(mocks.openSearch).toHaveBeenCalledTimes(1);
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
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(await Shell({ children: <main>Page</main>, initialUserSnapshot: null }));
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
