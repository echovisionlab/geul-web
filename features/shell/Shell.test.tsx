// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShellViewProps } from './ui/Shell';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  pathname: '/work',
  push: vi.fn(),
  signOut: vi.fn(),
  toggleColorScheme: vi.fn(),
  viewProps: null as ShellViewProps | null,
}));

vi.mock('next/link', () => ({ default: () => null }));

vi.mock('next-intl', () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock('@mantine/core', () => ({
  useComputedColorScheme: () => 'light',
  useMantineColorScheme: () => ({ toggleColorScheme: mocks.toggleColorScheme }),
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

vi.mock('@mantine/spotlight', () => ({
  spotlight: { open: vi.fn() },
}));

vi.mock('@/features/shell/PrintHeader', () => ({ PrintHeader: () => null }));
vi.mock('@/features/site/SiteLogo', () => ({ SiteLogo: () => null }));
vi.mock('@/features/social-links/SocialLinksDisplay', () => ({ SocialLinksDisplay: () => null }));
vi.mock('./LanguageMenu', () => ({ LanguageMenu: () => null }));

vi.mock('@/lib/auth/client', () => ({
  signOut: mocks.signOut,
  useSession: () => ({ data: null, isPending: false }),
}));

vi.mock('@/lib/auth/login-page', () => ({
  buildLoginRedirectHref: (pathname: string) => `/login?redirect=${pathname}`,
}));

vi.mock('@/lib/contexts/ManifestContext', () => ({
  useMenus: () => ({ avatarDropdown: [], footer: [], header: [], secondary: [] }),
  useSiteSettings: () => ({
    settings: {
      company_address: '',
      company_name: 'Example Studio',
      meta_description: '',
      site_title: 'Example Studio',
      social_links: null,
      tax_id: '',
    },
  }),
}));

vi.mock('@/lib/cookie-consent', () => ({
  COOKIE_CONSENT_OPEN_EVENT: 'geul:cookie-consent-open',
}));

vi.mock('@/lib/site-version', () => ({ APP_VERSION_LABEL: 'v-test' }));

vi.mock('@/lib/utils/managed-image-url', () => ({
  buildManagedImageUrl: () => null,
  MANAGED_IMAGE_PRESET: { AVATAR_MD: 'md', AVATAR_SM: 'sm', AVATAR_XS: 'xs' },
}));

vi.mock('@/lib/utils/menu', () => ({
  isMenuUrlActive: (pathname: string, href: string) => pathname === href,
  resolveMenuUrl: (item: { url?: string }) => item.url ?? '/',
}));

vi.mock('./ui/Shell', () => ({
  ShellView: (props: ShellViewProps) => {
    mocks.viewProps = props;
    return props.children;
  },
}));

import { Shell } from './Shell';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.pathname = '/work';
  mocks.viewProps = null;
  mocks.invalidateQueries.mockReset();
  mocks.invalidateQueries.mockResolvedValue(undefined);
  mocks.push.mockReset();
  mocks.signOut.mockReset();
  mocks.signOut.mockResolvedValue(undefined);
  mocks.toggleColorScheme.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderController(children: ReactNode = <main>Page content</main>) {
  act(() => {
    root.render(<Shell>{children}</Shell>);
  });
}

function viewProps() {
  expect(mocks.viewProps).not.toBeNull();
  return mocks.viewProps!;
}

describe('Shell controller disclosure state', () => {
  it('owns navigation and account state and closes both when navigation completes', () => {
    renderController();
    expect(viewProps()).toMatchObject({ navigationOpened: false, userMenuOpened: false });

    act(() => viewProps().events.onToggleNavigation());
    expect(viewProps().navigationOpened).toBe(true);

    act(() => viewProps().events.onOpenUserMenu());
    expect(viewProps().userMenuOpened).toBe(true);

    act(() => viewProps().events.onCloseUserMenu());
    expect(viewProps().userMenuOpened).toBe(false);

    act(() => viewProps().events.onOpenUserMenu());
    expect(viewProps().userMenuOpened).toBe(true);

    act(() => viewProps().events.onNavigate('/my/profile'));
    expect(viewProps()).toMatchObject({ navigationOpened: false, userMenuOpened: false });
  });

  it('closes mobile navigation when the active route changes', () => {
    renderController();
    act(() => viewProps().events.onToggleNavigation());
    expect(viewProps().navigationOpened).toBe(true);

    mocks.pathname = '/about';
    renderController();
    expect(viewProps().navigationOpened).toBe(false);
  });

  it('hands logout to the full-page auth redirect without racing it with SPA navigation', () => {
    renderController();
    act(() => viewProps().events.onOpenUserMenu());
    expect(viewProps().userMenuOpened).toBe(true);

    act(() => viewProps().events.onSignOut());

    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(viewProps().userMenuOpened).toBe(false);
  });
});
