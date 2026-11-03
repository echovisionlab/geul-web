import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { useTranslations } from 'next-intl';
import { IconArticle, IconSettings, IconUser, IconShield, IconFiles } from '@tabler/icons-react';
import { ShellView } from '@/features/shell/ui/Shell/ShellView';
import { AdminShellView } from '@/features/admin/ui/AdminShell/AdminShellView';
import { UserShellView } from '@/features/user/ui/UserShell/UserShellView';
import { SiteLogo } from '@/features/site/SiteLogo';
import { SITE_LOGO_HEIGHT } from '@/features/site/SiteLogo/placements';
import { SessionProvider } from '@/lib/providers/SessionProvider';
import { LanguageMenu } from '@/features/shell/LanguageMenu';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { navigatePreview } from '../shared/preview-navigation';
import { withStackedBrand } from '../shared/stacked-brand';
import { CommandPalette, CommandPaletteResults } from '@/components/core/CommandPalette';
import { FormModal } from '@/components/core/Modal/FormModal';
import { Checkbox } from '@/components/core/Input';
import { useColorScheme } from '@/lib/providers/DesignSystemProvider';
import { LayoutStack } from '@/components/core/Layout';
import { Text, Heading } from '@/components/core/Typography';
import { Avatar } from '@/components/core/Display';
import { SectionCard } from '@/components/core/Section';
export function FramesPreview({
  kind = 'public',
  mode = 'expanded',
  signedIn = false,
  nestedNavigation = false,
}: {
  kind?: 'public' | 'admin' | 'account';
  mode?: 'expanded' | 'compact';
  signedIn?: boolean;
  nestedNavigation?: boolean;
}) {
  const { settings } = useSiteSettings();
  const siteTitle = settings.site_title || 'Quiet Signal';
  const t = useTranslations('common'),
    shell = useTranslations('shell'),
    admin = useTranslations('adminShell'),
    files = useTranslations('fileManager');
  const { computedColorScheme: theme, toggleColorScheme } = useColorScheme();
  const [authenticated, setAuthenticated] = useState(signedIn);
  const [panel, setPanel] = useState<'search' | 'cookies' | null>(null);
  const [query, setQuery] = useState('');
  const [analytics, setAnalytics] = useState(false);
  const [savedAnalytics, setSavedAnalytics] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 48em)');
  const [opened, setOpened] = useState(false),
    [userOpen, setUserOpen] = useState(false),
    [sections, setSections] = useState<string[]>(['content']),
    [navigationMode, setMode] = useState(mode),
    [tab, setTab] = useState('profile'),
    [action] = useState('');
  const children = (
    <LayoutStack gap="md">
      <Heading level={1}>{t('labels.dashboard')}</Heading>
      <SectionCard>
        <Text>
          {action ||
            (kind === 'account'
              ? t(tab === 'security' ? 'labels.security' : tab === 'settings' ? 'labels.settings' : 'labels.profile')
              : t('labels.description'))}
        </Text>
      </SectionCard>
    </LayoutStack>
  );
  if (kind === 'account') {
    return (
      <UserShellView
        user={{
          name: 'June Han',
          roleLabel: t('roles.author'),
          roleTone: 'neutral',
          navigationLabel: t('labels.account'),
        }}
        tabs={[
          { value: 'profile', label: t('labels.profile'), icon: IconUser },
          { value: 'security', label: t('labels.security'), icon: IconShield },
          { value: 'settings', label: t('labels.settings'), icon: IconSettings },
        ]}
        currentTab={tab}
        events={{
          onTabChange: (value) => {
            if (value) {
              setTab(value);
            }
          },
        }}
        avatarSlot={<Avatar size="xl">J</Avatar>}
      >
        {children}
      </UserShellView>
    );
  }
  if (kind === 'admin') {
    return (
      <AdminShellView
        navSections={[
          {
            key: 'content',
            title: t('entities.posts'),
            icon: IconArticle,
            items: [
              { href: '/admin/posts', label: t('entities.posts'), icon: IconArticle, active: true },
              { href: '/admin/files', label: files('title'), icon: IconFiles, active: false },
            ],
          },
        ]}
        navigationMode={isDesktop ? navigationMode : 'compact'}
        navigationToggleVisible={isDesktop}
        openSectionKeys={sections}
        colorScheme={theme}
        labels={{
          subtitle: admin('subtitle'),
          compactLabel: admin('compactLabel'),
          navigation: admin('subtitle'),
          toggleNavigation: t('actions.toggleNavigation'),
          toggleColorScheme: t('actions.toggleColorScheme'),
          lightMode: t('theme.lightMode'),
          darkMode: t('theme.darkMode'),
          backToSite: admin('actions.backToSite'),
        }}
        events={{
          onToggleNavigation: () => {
            if (isDesktop) {
              setMode((current) => (current === 'expanded' ? 'compact' : 'expanded'));
            }
          },
          onToggleSection: (key) =>
            setSections((current) =>
              current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
            ),
          onToggleColorScheme: toggleColorScheme,
          onNavigate: navigatePreview,
        }}
        logoSlot={<SiteLogo height={SITE_LOGO_HEIGHT.adminExpanded} />}
        compactLogoSlot={<SiteLogo form="symbol" height={SITE_LOGO_HEIGHT.adminCompact} />}
      >
        {children}
      </AdminShellView>
    );
  }
  const nav = [
    {
      id: 'posts',
      label: t('entities.posts'),
      href: '/posts',
      active: true,
      openInNewTab: false,
      children: nestedNavigation
        ? [
            {
              id: 'posts-all',
              label: t('entities.posts'),
              href: '/posts',
              active: true,
              openInNewTab: false,
              children: [],
            },
            {
              id: 'posts-series',
              label: t('entities.series'),
              href: '/series',
              active: false,
              openInNewTab: false,
              children: [],
            },
          ]
        : [],
    },
    { id: 'works', label: t('entities.works'), href: '/works', active: false, openInNewTab: false, children: [] },
  ];
  return (
    <ShellView
      loginHref="/login"
      navigationOpened={opened}
      userMenuOpened={userOpen}
      themeMode={theme}
      user={
        authenticated
          ? {
              kind: 'authenticated',
              name: 'June Han',
              email: 'june@example.com',
              imageUrls: { compact: null, mobile: null, detail: null },
            }
          : null
      }
      headerItems={nav}
      secondaryItems={[]}
      footerItems={nav}
      accountItems={[
        { id: 'account', label: t('labels.account'), href: '/my', active: false, openInNewTab: false, children: [] },
      ]}
      footer={{
        siteTitle,
        description: null,
        copyright: '© 2026 Quiet Signal',
        taxId: null,
        companyAddress: null,
        version: 'Preview',
        showChangelog: false,
      }}
      labels={{
        navigation: siteTitle,
        navigationLoadFailed: t('messages.failedToLoad'),
        retryNavigation: t('loadMore.retry'),
        toggleNavigation: t('actions.toggleNavigation'),
        close: t('actions.close'),
        search: shell('actions.search'),
        searchTooltip: shell('actions.searchTooltip', { shortcut: '⌘K' }),
        signIn: shell('actions.signIn'),
        account: t('labels.account'),
        logOut: t('actions.logOut'),
        toggleColorScheme: t('actions.toggleColorScheme'),
        themeTooltip: t('actions.toggleColorScheme'),
        cookieSettings: shell('actions.cookieSettings'),
        changelog: 'Changelog',
        newsletter: t('labels.newsletter'),
        footerSiteInfo: shell('footer.siteInfo'),
        footerLinks: shell('footer.links'),
        footerSocialMedia: shell('footer.socialMedia'),
      }}
      events={{
        onToggleNavigation: () => setOpened((current) => !current),
        onOpenUserMenu: () => setUserOpen(true),
        onCloseUserMenu: () => setUserOpen(false),
        onSearch: () => setPanel('search'),
        onToggleColorScheme: toggleColorScheme,
        onSignOut: () => {
          setAuthenticated(false);
          setUserOpen(false);
        },
        onOpenCookieSettings: () => {
          setAnalytics(savedAnalytics);
          setPanel('cookies');
        },
        onNavigate: navigatePreview,
      }}
      slots={{
        logo: <SiteLogo height={SITE_LOGO_HEIGHT.header} />,
        printHeader: null,
        printWatermark: <SiteLogo form="symbol" height={SITE_LOGO_HEIGHT.printWatermark} />,
        languageDesktop: <LanguageMenu />,
        languageNavigation: <LanguageMenu variant="navigation" />,
        languageFooterDesktop: null,
        languageFooterMobile: null,
        socialLinks: null,
      }}
    >
      {children}
      {/* Same Core palette and copy roles as production PostSpotlight; navigation entries stand in for post results. */}
      <CommandPalette
        opened={panel === 'search'}
        onClose={() => setPanel(null)}
        title={shell('actions.search')}
        closeLabel={t('actions.close')}
        query={query}
        onQueryChange={setQuery}
        placeholder={t('placeholders.searchPosts')}
      >
        <CommandPaletteResults
          items={query.length < 2 ? [] : nav.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))}
          label={t('placeholders.searchPosts')}
          emptyLabel={
            query.length < 2 ? t('messages.typeAtLeast2Characters', { count: 2 }) : t('messages.noPostsFound')
          }
        />
      </CommandPalette>
      <FormModal
        opened={panel === 'cookies'}
        onClose={() => setPanel(null)}
        title={shell('actions.cookieSettings')}
        submitLabel={t('actions.save')}
        cancelLabel={t('actions.cancel')}
        closeLabel={t('actions.close')}
        onSubmit={() => {
          setSavedAnalytics(analytics);
          setPanel(null);
        }}
      >
        <Checkbox
          label={t('labels.settings')}
          checked={analytics}
          onChange={(event) => setAnalytics(event.currentTarget.checked)}
        />
      </FormModal>
    </ShellView>
  );
}
const meta = {
  title: 'Pages/Application/Frames',
  excludeStories: ['FramesPreview'],
  component: FramesPreview,
  decorators: [
    (Story) => (
      <SessionProvider initialData={null}>
        <Story />
      </SessionProvider>
    ),
  ],
  args: { kind: 'public', mode: 'expanded', signedIn: false },
  render: (args) => <FramesPreview key={`${args.kind}-${args.mode}-${args.signedIn}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/posts' } },
    docs: {
      description: {
        component:
          'Production application frames with working drawers, user menu, navigation modes, account tabs, theme switch, search and cookie preferences. Links open mapped Storybook previews.',
      },
    },
  },
} satisfies Meta<typeof FramesPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Public: Story = {};
export const SignedIn: Story = { args: { signedIn: true } };
export const Admin: Story = { args: { kind: 'admin' } };
export const AdminCompact: Story = { args: { kind: 'admin', mode: 'compact' } };
export const AdminPhone: Story = {
  args: { kind: 'admin' },
  globals: { viewport: { value: 'phone', isRotated: false } },
};
export const Account: Story = { args: { kind: 'account' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

export const NavigationHierarchy: Story = { args: { signedIn: true, nestedNavigation: true } };

export const StackedBrand: Story = { decorators: [withStackedBrand] };
export const StackedBrandSignedIn: Story = { args: { signedIn: true }, decorators: [withStackedBrand] };
export const StackedBrandAdmin: Story = { args: { kind: 'admin' }, decorators: [withStackedBrand] };
export const StackedBrandAdminCompact: Story = {
  args: { kind: 'admin', mode: 'compact' },
  decorators: [withStackedBrand],
};
