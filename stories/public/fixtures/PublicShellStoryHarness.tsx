import { forwardRef, useLayoutEffect, useMemo, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { IconLanguage } from '@tabler/icons-react';
import { Group } from '@mantine/core';
import { IconButton } from '@/components/core/IconButton';
import { SocialIcon } from '@/components/core/Social';
import { TextButton } from '@/components/core/TextButton';
import { PrintHeaderView } from '@/features/shell/ui/PrintHeader';
import { ShellView, type ShellViewNavigationItem } from '@/features/shell/ui/Shell';
import { SiteLogoView } from '@/features/site/ui/SiteLogo';
import { APP_VERSION_LABEL } from '@/lib/site-version';

export const EXAMPLE_STUDIO_LOGO_STORY_URL = '/storybook/media/example-studio-logo.svg';

interface NavigationFixture {
  id: string;
  label: string;
  href: string;
  openInNewTab?: boolean;
  children?: NavigationFixture[];
}

const HEADER_ITEMS: NavigationFixture[] = [
  { id: 'home', label: 'Home', href: '/' },
  {
    id: 'explore',
    label: 'Explore',
    href: '/explore',
    children: [
      { id: 'artists', label: 'Artists', href: '/artists' },
      { id: 'works', label: 'Works', href: '/works' },
      { id: 'events', label: 'Events', href: '/events' },
    ],
  },
  { id: 'journal', label: 'Journal', href: '/posts' },
];

const SECONDARY_ITEMS: NavigationFixture[] = [
  { id: 'about', label: 'About', href: '/about' },
  { id: 'contact', label: 'Contact', href: '/contact' },
];

const FOOTER_ITEMS: NavigationFixture[] = [
  { id: 'privacy', label: 'Privacy', href: '/privacy' },
  { id: 'terms', label: 'Terms', href: '/terms' },
  { id: 'accessibility', label: 'Accessibility', href: '/accessibility' },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

function toNavigation(items: NavigationFixture[], pathname: string): ShellViewNavigationItem[] {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    href: item.href,
    active: isActive(pathname, item.href),
    openInNewTab: item.openInNewTab ?? false,
    children: toNavigation(item.children ?? [], pathname),
  }));
}

const StoryLink = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<'a'>>(({ href, onClick, ...props }, ref) => (
  <a
    ref={ref}
    {...props}
    href={href}
    onClick={(event) => {
      event.preventDefault();
      onClick?.(event);
    }}
  />
));
StoryLink.displayName = 'StoryLink';

function HeaderLanguageControl() {
  return (
    <IconButton size={32} aria-label="Change language">
      <IconLanguage size={16} aria-hidden />
    </IconButton>
  );
}

function FooterLanguageControl() {
  return (
    <TextButton appearance="muted" size="xs" controlSize="xs" aria-label="Change language">
      English
    </TextButton>
  );
}

export interface PublicShellStoryHarnessProps {
  children: ReactNode;
  initialPath: string;
  initialTheme?: 'light' | 'dark' | null;
}

/** Storybook-only composition of the same pure shell View used by public routes. */
export function PublicShellStoryHarness({
  children,
  initialPath,
  initialTheme = 'light',
}: PublicShellStoryHarnessProps) {
  const [pathname, setPathname] = useState(initialPath);
  const [navigationOpened, setNavigationOpened] = useState(false);
  const [themeMode, setThemeMode] = useState(initialTheme);
  const headerItems = useMemo(() => toNavigation(HEADER_ITEMS, pathname), [pathname]);
  const secondaryItems = useMemo(() => toNavigation(SECONDARY_ITEMS, pathname), [pathname]);
  const footerItems = useMemo(() => toNavigation(FOOTER_ITEMS, pathname), [pathname]);

  useLayoutEffect(() => {
    if (themeMode === null) {
      return;
    }

    const root = document.documentElement;
    const previousScheme = root.getAttribute('data-mantine-color-scheme');
    root.setAttribute('data-mantine-color-scheme', themeMode);

    return () => {
      if (previousScheme === null) {
        root.removeAttribute('data-mantine-color-scheme');
      } else {
        root.setAttribute('data-mantine-color-scheme', previousScheme);
      }
    };
  }, [themeMode]);

  const handleNavigate = (href: string) => {
    setPathname(href);
    setNavigationOpened(false);
  };

  return (
    <ShellView
      loginHref={`/login?redirect=${encodeURIComponent(pathname)}`}
      navigationOpened={navigationOpened}
      userMenuOpened={false}
      themeMode={themeMode}
      user={null}
      headerItems={headerItems}
      secondaryItems={secondaryItems}
      footerItems={footerItems}
      accountItems={[]}
      footer={{
        siteTitle: 'Example Studio',
        description: 'Independent publishing and spatial media.',
        copyright: '© 2026 Example Studio',
        taxId: '123-45-67890',
        companyAddress: 'Seoul, Republic of Korea',
        version: APP_VERSION_LABEL,
        showChangelog: false,
      }}
      labels={{
        navigation: 'Example Studio navigation',
        toggleNavigation: 'Toggle navigation',
        close: 'Close',
        search: 'Search',
        searchTooltip: 'Search (Ctrl+K)',
        signIn: 'Sign in',
        account: 'Account',
        logOut: 'Log out',
        toggleColorScheme: 'Toggle color scheme',
        themeTooltip: themeMode === 'dark' ? 'Light mode' : themeMode === 'light' ? 'Dark mode' : 'Toggle color scheme',
        cookieSettings: 'Cookie settings',
        changelog: 'Changelog',
        newsletter: 'Newsletter',
        footerSiteInfo: 'Site information',
        footerLinks: 'Links',
        footerSocialMedia: 'Social media',
      }}
      events={{
        onToggleNavigation: () => setNavigationOpened((opened) => !opened),
        onOpenUserMenu: () => undefined,
        onCloseUserMenu: () => undefined,
        onSearch: () => undefined,
        onToggleColorScheme: () => setThemeMode((mode) => (mode === 'dark' ? 'light' : 'dark')),
        onSignOut: () => undefined,
        onOpenCookieSettings: () => undefined,
        onNavigate: handleNavigate,
      }}
      slots={{
        logo: <SiteLogoView src={EXAMPLE_STUDIO_LOGO_STORY_URL} alt="Example Studio" height={16} />,
        printHeader: (
          <PrintHeaderView
            logoSrc={EXAMPLE_STUDIO_LOGO_STORY_URL}
            logoAlt="Example Studio"
            companyName="Example Studio"
            taxId="123-45-67890"
          />
        ),
        printWatermark: <SiteLogoView src={EXAMPLE_STUDIO_LOGO_STORY_URL} alt="Example Studio" height={24} />,
        languageDesktop: <HeaderLanguageControl />,
        languageMobile: <HeaderLanguageControl />,
        languageFooterDesktop: <FooterLanguageControl />,
        languageFooterMobile: <FooterLanguageControl />,
        socialLinks: (
          <Group gap="sm">
            <a href="https://instagram.com" aria-label="Instagram">
              <SocialIcon platform="instagram" size={18} colorMode="hoverBrand" />
            </a>
            <a href="https://youtube.com" aria-label="YouTube">
              <SocialIcon platform="youtube" size={18} colorMode="hoverBrand" />
            </a>
          </Group>
        ),
      }}
      linkComponent={StoryLink}
    >
      {children}
    </ShellView>
  );
}
