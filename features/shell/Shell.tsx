import type { ReactNode } from 'react';
import type { SiteVariableContext } from '@echovisionlab/geul-common/site-variables';
import { resolveSiteVariableHref, siteVariableContext } from '@/lib/site-variables';
import { getTranslations } from 'next-intl/server';
import type { MenuItem } from '@echovisionlab/geul-proto/public/manifest_pb.ts';
import { PrintHeader } from '@/features/shell/PrintHeader';
import { SiteLogo } from '@/features/site/SiteLogo';
import { SITE_LOGO_HEIGHT } from '@/features/site/SiteLogo/placements';
import { ServerSocialLinksDisplay } from '@/features/social-links/ServerSocialLinksDisplay';
import type { UserDisplaySnapshot } from '@/lib/auth/user-display-cookie';
import { getManifest } from '@/lib/queries/manifest';
import { APP_VERSION_LABEL } from '@/lib/site-version';
import { DEFAULT_SITE_SETTINGS_VIEW } from '@/lib/types/site-setting/config';
import { resolveMenuUrl } from '@/lib/utils/menu';
import { getRequestLocaleContext } from '@/lib/utils/language.server';
import { LanguageMenu } from './LanguageMenu';
import { ShellRuntime } from './ShellRuntime';
import { ShellLayout } from './ui/Shell/ShellLayout';
import type { ShellViewNavigationItem } from './ui/Shell/shell-types';

interface ShellProps {
  children: ReactNode;
  initialUserSnapshot?: UserDisplaySnapshot | null;
}

/** Current-route state is derived on the client (`ShellRuntime`), so the server leaves it unset. */
function toNavigationItem(item: MenuItem, variables: SiteVariableContext): ShellViewNavigationItem {
  return {
    id: item.id,
    label: item.label,
    href: resolveSiteVariableHref(resolveMenuUrl(item), variables) ?? '',
    active: false,
    openInNewTab: item.openInNewTab ?? false,
    children: (item.children ?? []).map((item) => toNavigationItem(item, variables)),
  };
}

/**
 * Public site shell. Header, navigation and footer render on the server from the request's manifest
 * and messages; `ShellRuntime` and the islands in `ShellIslands` hydrate the interactive parts.
 * Menus are already filtered by user role on the backend.
 */
export async function Shell({ children, initialUserSnapshot }: ShellProps) {
  const { locale } = await getRequestLocaleContext();
  const [manifest, tShell, tCommon, tCommonActions] = await Promise.all([
    getManifest({ requestedLocale: locale }),
    getTranslations('shell'),
    getTranslations('common'),
    getTranslations('common.actions'),
  ]);
  const settings = { ...DEFAULT_SITE_SETTINGS_VIEW, ...manifest.settings };
  const menus = manifest.menus;
  const variables = siteVariableContext(settings);
  const companyName = settings.company_name || settings.site_title;
  return (
    <ShellRuntime
      initialUserSnapshot={initialUserSnapshot}
      labels={{
        searchTooltipMac: tShell('actions.searchTooltip', { shortcut: 'Cmd+K' }),
        searchTooltipOther: tShell('actions.searchTooltip', { shortcut: 'Ctrl+K' }),
        lightMode: tCommon('theme.lightMode'),
        darkMode: tCommon('theme.darkMode'),
        toggleColorScheme: tCommonActions('toggleColorScheme'),
        signOutUnsavedTitle: tShell('signOutUnsaved.title'),
        signOutUnsavedMessage: tShell('signOutUnsaved.message'),
        signOutUnsavedConfirm: tShell('signOutUnsaved.confirm'),
        cancel: tCommonActions('cancel'),
        close: tCommonActions('close'),
      }}
    >
      <ShellLayout
        headerItems={(menus?.header ?? []).map((item) => toNavigationItem(item, variables))}
        secondaryItems={(menus?.secondary ?? []).map((item) => toNavigationItem(item, variables))}
        footerItems={(menus?.footer ?? []).map((item) => toNavigationItem(item, variables))}
        accountItems={(menus?.avatarDropdown ?? []).map((item) => toNavigationItem(item, variables))}
        footer={{
          siteTitle: settings.site_title,
          description: settings.meta_description || null,
          copyright: `© ${new Date().getFullYear()} ${companyName}`,
          taxId: settings.tax_id || null,
          companyAddress: settings.company_address || null,
          version: APP_VERSION_LABEL,
        }}
        labels={{
          navigation: settings.site_title,
          toggleNavigation: tCommonActions('toggleNavigation'),
          close: tCommonActions('close'),
          search: tShell('actions.search'),
          signIn: tShell('actions.signIn'),
          account: tCommon('labels.account'),
          logOut: tCommonActions('logOut'),
          toggleColorScheme: tCommonActions('toggleColorScheme'),
          cookieSettings: tShell('actions.cookieSettings'),
          changelog: 'Changelog',
          newsletter: tCommon('labels.newsletter'),
          footerSiteInfo: tShell('footer.siteInfo'),
          footerLinks: tShell('footer.links'),
          footerSocialMedia: tShell('footer.socialMedia'),
        }}
        slots={{
          logo: <SiteLogo height={SITE_LOGO_HEIGHT.header} />,
          printHeader: <PrintHeader />,
          printWatermark: <SiteLogo form="symbol" height={SITE_LOGO_HEIGHT.printWatermark} />,
          languageDesktop: <LanguageMenu />,
          languageNavigation: <LanguageMenu variant="navigation" />,
          languageFooterDesktop: <LanguageMenu variant="text" textSize="xs" />,
          languageFooterMobile: <LanguageMenu variant="text" textSize="xs" />,
          socialLinks: <ServerSocialLinksDisplay links={settings.social_links} gap="sm" />,
        }}
      >
        {children}
      </ShellLayout>
    </ShellRuntime>
  );
}
