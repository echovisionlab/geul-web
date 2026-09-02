'use client';

import { type ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MenuItem } from '@echovisionlab/geul-proto/public/manifest_pb.ts';
import { useTranslations } from 'next-intl';
import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { useDisclosure, useMounted, useOs } from '@mantine/hooks';
import { spotlight } from '@mantine/spotlight';
import { PrintHeader } from '@/features/shell/PrintHeader';
import { SiteLogo } from '@/features/site/SiteLogo';
import { SocialLinksDisplay } from '@/features/social-links/SocialLinksDisplay';
import { signOut, useSession } from '@/lib/auth/client';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import type { UserDisplaySnapshot } from '@/lib/auth/user-display-cookie';
import { useMenus, useSiteSettings } from '@/lib/contexts/ManifestContext';
import { COOKIE_CONSENT_OPEN_EVENT } from '@/lib/cookie-consent';
import { APP_VERSION_LABEL } from '@/lib/site-version';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import { isMenuUrlActive, resolveMenuUrl } from '@/lib/utils/menu';
import { LanguageMenu } from './LanguageMenu';
import { ShellView, type ShellViewNavigationItem, type ShellViewUser } from './ui/Shell';

interface ShellProps {
  children: ReactNode;
  initialMenus?: {
    header?: MenuItem[];
    secondary?: MenuItem[];
    footer?: MenuItem[];
  };
  initialUserSnapshot?: UserDisplaySnapshot | null;
}

function toNavigationItem(item: MenuItem, pathname: string): ShellViewNavigationItem {
  const href = resolveMenuUrl(item);

  return {
    id: item.id,
    label: item.label,
    href,
    active: isMenuUrlActive(pathname, href),
    openInNewTab: item.openInNewTab ?? false,
    children: (item.children ?? []).map((child) => toNavigationItem(child, pathname)),
  };
}

function buildShellUser(
  sessionUser: {
    nickname: string;
    email: string | null;
    image: string | null | undefined;
  } | null,
  sessionPending: boolean,
  initialUserSnapshot: UserDisplaySnapshot | null | undefined,
): ShellViewUser | null {
  const user = sessionUser
    ? {
        kind: 'authenticated' as const,
        name: sessionUser.nickname,
        email: sessionUser.email,
        image: sessionUser.image,
      }
    : sessionPending && initialUserSnapshot
      ? {
          kind: 'snapshot' as const,
          name: initialUserSnapshot.name,
          email: null,
          image: initialUserSnapshot.image,
        }
      : null;

  if (!user) {
    return null;
  }

  return {
    kind: user.kind,
    name: user.name,
    email: user.email,
    imageUrls: {
      compact: buildManagedImageUrl(user.image, MANAGED_IMAGE_PRESET.AVATAR_XS) ?? null,
      mobile: buildManagedImageUrl(user.image, MANAGED_IMAGE_PRESET.AVATAR_SM) ?? null,
      detail: buildManagedImageUrl(user.image, MANAGED_IMAGE_PRESET.AVATAR_MD) ?? null,
    },
  };
}

export function Shell({ children, initialMenus, initialUserSnapshot }: ShellProps) {
  const tShell = useTranslations('shell');
  const tCommon = useTranslations('common');
  const tCommonActions = useTranslations('common.actions');
  const pathname = usePathname();
  const [navigationOpened, { toggle: toggleNavigation, close: closeNavigation }] = useDisclosure();
  const [userMenuOpened, { open: openUserMenu, close: closeUserMenu }] = useDisclosure();
  const { toggleColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: false });
  const mounted = useMounted();
  const { data: session, isPending: isSessionPending } = useSession();
  const os = useOs();
  const modKey = os === 'macos' ? 'Cmd' : 'Ctrl';
  const { settings } = useSiteSettings();
  const menus = useMenus();

  const user = buildShellUser(
    session?.onboarded ? session.user : null,
    isSessionPending,
    session?.onboarded === false ? null : initialUserSnapshot,
  );
  const headerItems = (initialMenus?.header ?? menus.header ?? []).map((item) =>
    toNavigationItem(item as MenuItem, pathname),
  );
  const secondaryItems = (initialMenus?.secondary ?? menus.secondary ?? []).map((item) =>
    toNavigationItem(item as MenuItem, pathname),
  );
  const footerItems = (initialMenus?.footer ?? menus.footer ?? []).map((item) =>
    toNavigationItem(item as MenuItem, pathname),
  );
  const accountItems = (menus.avatarDropdown as MenuItem[]).map((item) => toNavigationItem(item, pathname));
  const canViewChangelog = session?.user.role === 'admin' || session?.user.role === 'author';
  const companyName = settings.company_name || settings.site_title;

  useEffect(() => {
    closeNavigation();
  }, [pathname, closeNavigation]);

  const handleSignOut = () => {
    closeUserMenu();
    signOut();
  };

  const handleNavigate = () => {
    closeNavigation();
    closeUserMenu();
  };

  const openCookieSettings = () => {
    window.dispatchEvent(new Event(COOKIE_CONSENT_OPEN_EVENT));
  };

  const themeMode = mounted ? computedColorScheme : null;
  const themeTooltip =
    themeMode === 'dark'
      ? tCommon('theme.lightMode')
      : themeMode === 'light'
        ? tCommon('theme.darkMode')
        : tCommonActions('toggleColorScheme');

  return (
    <ShellView
      loginHref={buildLoginRedirectHref(pathname)}
      navigationOpened={navigationOpened}
      userMenuOpened={userMenuOpened}
      themeMode={themeMode}
      user={user}
      headerItems={headerItems}
      secondaryItems={secondaryItems}
      footerItems={footerItems}
      accountItems={accountItems}
      footer={{
        siteTitle: settings.site_title,
        description: settings.meta_description || null,
        copyright: `© ${new Date().getFullYear()} ${companyName}`,
        taxId: settings.tax_id || null,
        companyAddress: settings.company_address || null,
        version: APP_VERSION_LABEL,
        showChangelog: canViewChangelog,
      }}
      labels={{
        navigation: settings.site_title,
        toggleNavigation: tCommonActions('toggleNavigation'),
        close: tCommonActions('close'),
        search: tShell('actions.search'),
        searchTooltip: tShell('actions.searchTooltip', { shortcut: `${modKey}+K` }),
        signIn: tShell('actions.signIn'),
        account: tCommon('labels.account'),
        logOut: tCommonActions('logOut'),
        toggleColorScheme: tCommonActions('toggleColorScheme'),
        themeTooltip,
        cookieSettings: tShell('actions.cookieSettings'),
        changelog: 'Changelog',
        newsletter: tCommon('labels.newsletter'),
        footerSiteInfo: tShell('footer.siteInfo'),
        footerLinks: tShell('footer.links'),
        footerSocialMedia: tShell('footer.socialMedia'),
      }}
      events={{
        onToggleNavigation: toggleNavigation,
        onOpenUserMenu: openUserMenu,
        onCloseUserMenu: closeUserMenu,
        onSearch: () => spotlight.open(),
        onToggleColorScheme: toggleColorScheme,
        onSignOut: handleSignOut,
        onOpenCookieSettings: openCookieSettings,
        onNavigate: handleNavigate,
      }}
      slots={{
        logo: <SiteLogo height={16} />,
        printHeader: <PrintHeader />,
        printWatermark: <SiteLogo height={24} />,
        languageDesktop: <LanguageMenu />,
        languageMobile: <LanguageMenu />,
        languageFooterDesktop: <LanguageMenu variant="text" textSize="xs" />,
        languageFooterMobile: <LanguageMenu variant="text" textSize="xs" />,
        socialLinks:
          settings.social_links && Object.keys(settings.social_links).length > 0 ? (
            <SocialLinksDisplay links={settings.social_links} gap="sm" />
          ) : null,
      }}
      linkComponent={Link}
    >
      {children}
    </ShellView>
  );
}
