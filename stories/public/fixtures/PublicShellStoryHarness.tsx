import { useColorScheme } from '@/lib/providers/DesignSystemProvider';
import { localizeFixtureTree, useStorybookText } from '@/.storybook/fixture-i18n';
import { useLocale } from 'next-intl';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { ContentModal } from '@/components/core/Modal';
import { FormModal } from '@/components/core/Modal/FormModal';
import { Checkbox, TextInput } from '@/components/core/Input';
import { Text } from '@/components/core/Typography';
import { navigatePreview, resolvePreviewStory } from '../../shared/preview-navigation';
import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { useMemo, useState, type ReactNode } from 'react';
import { IconLanguage } from '@tabler/icons-react';

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
  return items
    .filter((item) => resolvePreviewStory(item.href))
    .map((item) => ({
      id: item.id,
      label: item.label,
      href: item.href,
      active: isActive(pathname, item.href),
      openInNewTab: item.openInNewTab ?? false,
      children: toNavigation(item.children ?? [], pathname),
    }));
}

function LanguageControl({ variant = 'icon' }: { variant?: 'icon' | 'footer' | 'navigation' }) {
  const locale = useLocale();
  const text = useStorybookText();
  const changeLocale = (value: string) => {
    const target = window.parent && window.parent !== window ? window.parent : window;
    const url = new URL(target.location.href);
    const globals = (url.searchParams.get('globals') ?? '')
      .split(';')
      .filter((entry) => entry && !entry.startsWith('locale:'));
    url.searchParams.set('globals', [...globals, `locale:${value}`].join(';'));
    target.location.assign(url.toString());
  };
  return (
    <DropdownMenu>
      <DropdownMenu.Target>
        {variant === 'navigation' ? (
          <TextButton
            density="chrome"
            display="flex"
            fullWidth
            justify="start"
            indicator="menu"
            aria-label={text('Change language')}
          >
            <Text size="xs">{locale === 'ko' ? '한국어' : 'English'}</Text>
          </TextButton>
        ) : variant === 'footer' ? (
          <TextButton appearance="muted" size="xs" controlSize="xs" aria-label={text('Change language')}>
            {locale === 'ko' ? '한국어' : 'English'}
          </TextButton>
        ) : (
          <IconButton size="chrome" aria-label={text('Change language')}>
            <IconLanguage aria-hidden />
          </IconButton>
        )}
      </DropdownMenu.Target>
      <DropdownMenu.Dropdown>
        <DropdownMenu.Item selected={locale === 'ko'} onClick={() => changeLocale('ko')}>
          한국어
        </DropdownMenu.Item>
        <DropdownMenu.Item selected={locale === 'en'} onClick={() => changeLocale('en')}>
          English
        </DropdownMenu.Item>
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  );
}

export interface PublicShellStoryHarnessProps {
  children: ReactNode;
  initialPath: string;
  initialTheme?: 'light' | 'dark' | null;
}

/** Storybook-only composition of the same pure shell View used by public routes. */
export function PublicShellStoryHarness({ children, initialPath }: PublicShellStoryHarnessProps) {
  const [pathname, setPathname] = useState(initialPath);
  const [panel, setPanel] = useState<'search' | 'cookies' | null>(null);
  const [query, setQuery] = useState('');
  const [analytics, setAnalytics] = useState(false);
  const [savedAnalytics, setSavedAnalytics] = useState(false);
  const [navigationOpened, setNavigationOpened] = useState(false);
  const { computedColorScheme: themeMode, toggleColorScheme } = useColorScheme();
  const text = useStorybookText();
  const headerItems = useMemo(() => toNavigation(HEADER_ITEMS, pathname), [pathname]);
  const secondaryItems = useMemo(() => toNavigation(SECONDARY_ITEMS, pathname), [pathname]);
  const footerItems = useMemo(() => toNavigation(FOOTER_ITEMS, pathname), [pathname]);

  const handleNavigate = (href: string) => {
    setPathname(href);
    navigatePreview(href);
    setNavigationOpened(false);
  };

  return localizeFixtureTree(
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
        onSearch: () => {
          setQuery('');
          setPanel('search');
        },
        onToggleColorScheme: toggleColorScheme,
        onSignOut: () => undefined,
        onOpenCookieSettings: () => {
          setAnalytics(savedAnalytics);
          setPanel('cookies');
        },
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
        languageDesktop: <LanguageControl />,
        languageNavigation: <LanguageControl variant="navigation" />,
        languageFooterDesktop: <LanguageControl variant="footer" />,
        languageFooterMobile: <LanguageControl variant="footer" />,
        socialLinks: (
          <DsLayoutInline gap="sm">
            <a href="https://instagram.com" aria-label="Instagram">
              <SocialIcon platform="instagram" size="lg" colorMode="hoverBrand" />
            </a>
            <a href="https://youtube.com" aria-label="YouTube">
              <SocialIcon platform="youtube" size="lg" colorMode="hoverBrand" />
            </a>
          </DsLayoutInline>
        ),
      }}
    >
      {children}
      <ContentModal
        opened={panel === 'search'}
        onClose={() => setPanel(null)}
        title={text('Search')}
        closeLabel={text('Close')}
      >
        <TextInput label={text('Search')} value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
        {[...HEADER_ITEMS, ...HEADER_ITEMS.flatMap((item) => item.children ?? []), ...FOOTER_ITEMS]
          .filter((item) => resolvePreviewStory(item.href))
          .filter((item) => text(item.label).toLowerCase().includes(query.toLowerCase()))
          .map((item) => (
            <TextButton
              key={item.id}
              onClick={() => {
                setPanel(null);
                handleNavigate(item.href);
              }}
            >
              {text(item.label)}
            </TextButton>
          ))}
      </ContentModal>
      <FormModal
        opened={panel === 'cookies'}
        onClose={() => setPanel(null)}
        title={text('Cookie settings')}
        submitLabel={text('Save changes')}
        cancelLabel={text('Cancel')}
        closeLabel={text('Close')}
        onSubmit={() => {
          setSavedAnalytics(analytics);
          setPanel(null);
        }}
      >
        <Checkbox
          label={text('Analytics')}
          checked={analytics}
          onChange={(event) => setAnalytics(event.currentTarget.checked)}
        />
        <Text size="sm">{text('Preferences are stored in this preview.')}</Text>
      </FormModal>
    </ShellView>,
    text,
  );
}
