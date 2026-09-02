'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconArticle,
  IconBriefcase,
  IconBuildingStore,
  IconCalendarEvent,
  IconCategory,
  IconCategory2,
  IconDashboard,
  IconDisc,
  IconFileText,
  IconFiles,
  IconFilter,
  IconForms,
  IconLanguage,
  IconList,
  IconMail,
  IconMailbox,
  IconMailCog,
  IconMapPin,
  IconMenu2,
  IconPalette,
  IconPhoto,
  IconSettings,
  IconStack2,
  IconTag,
  IconTags,
  IconUsers,
  IconUserStar,
  IconVinyl,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { useMediaQuery, useMounted } from '@mantine/hooks';
import { SiteLogo } from '@/features/site/SiteLogo';
import type { AdminNavigationSection } from '@/features/admin/ui/AdminNavigation';
import { AdminShellView } from '@/features/admin/ui/AdminShell';

interface AdminNavRouteItem {
  href: string;
  label: string;
  icon: typeof IconDashboard;
  exact?: boolean;
  prefetch?: boolean;
}

interface AdminNavRouteSection {
  key: string;
  title?: string;
  icon?: typeof IconDashboard;
  items: AdminNavRouteItem[];
}

export function isAdminNavItemActive(pathname: string, item: Pick<AdminNavRouteItem, 'exact' | 'href'>) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations('adminShell');
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tFileManager = useTranslations('fileManager');
  const pathname = usePathname();
  const isDesktop = useMediaQuery('(min-width: 48em)');
  const [desktopNavigationExpanded, setDesktopNavigationExpanded] = useState(true);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const { toggleColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', {
    getInitialValueInEffect: false,
  });
  const mounted = useMounted();

  const routeSections = useMemo<AdminNavRouteSection[]>(
    () => [
      {
        key: 'root',
        items: [
          {
            href: '/admin',
            label: tCommon('labels.dashboard'),
            icon: IconDashboard,
            exact: true,
          },
        ],
      },
      {
        key: 'content',
        title: t('sections.content'),
        icon: IconArticle,
        items: [
          { href: '/admin/posts', label: tCommonEntities('posts'), icon: IconArticle },
          { href: '/admin/series', label: tCommonEntities('series'), icon: IconList },
          { href: '/admin/categories', label: tCommonEntities('categories'), icon: IconCategory },
          { href: '/admin/tags', label: tCommonEntities('tags'), icon: IconTag },
          { href: '/admin/pages', label: tCommonEntities('pages'), icon: IconFileText },
          { href: '/admin/files', label: tFileManager('title'), icon: IconFiles },
          {
            href: '/admin/events',
            label: tCommonEntities('programEvents'),
            icon: IconCalendarEvent,
          },
          {
            href: '/admin/event-series',
            label: tCommonEntities('programEventSeries'),
            icon: IconList,
          },
          { href: '/admin/forms', label: tCommonEntities('forms'), icon: IconForms },
          {
            href: '/admin/map',
            label: tCommonEntities('mapPlaces'),
            icon: IconMapPin,
            exact: true,
          },
          { href: '/admin/map/themes', label: tCommonEntities('mapThemes'), icon: IconPalette },
          { href: '/admin/works', label: tCommonEntities('works'), icon: IconVinyl },
          { href: '/admin/clients', label: tCommonEntities('clients'), icon: IconBriefcase },
        ],
      },
      {
        key: 'music',
        title: t('sections.music'),
        icon: IconDisc,
        items: [
          { href: '/admin/releases', label: tCommonEntities('releases'), icon: IconDisc },
          { href: '/admin/artists', label: tCommonEntities('artists'), icon: IconUserStar },
          { href: '/admin/labels', label: tCommonEntities('labels'), icon: IconBuildingStore },
          { href: '/admin/genres', label: tCommonEntities('genres'), icon: IconCategory2 },
          { href: '/admin/styles', label: tCommonEntities('styles'), icon: IconPalette },
          { href: '/admin/formats', label: tCommonEntities('formats'), icon: IconStack2 },
        ],
      },
      {
        key: 'communications',
        title: t('sections.communications'),
        icon: IconMail,
        items: [
          { href: '/admin/campaigns', label: tCommonEntities('campaigns'), icon: IconMail },
          {
            href: '/admin/audience-segments',
            label: tCommonEntities('audienceSegments'),
            icon: IconFilter,
          },
          { href: '/admin/user-tags', label: tCommonEntities('userTags'), icon: IconTags },
          {
            href: '/admin/email-templates',
            label: tCommonEntities('emailTemplates'),
            icon: IconMailbox,
          },
          {
            href: '/admin/email-layouts',
            label: tCommonEntities('emailLayouts'),
            icon: IconMailCog,
          },
        ],
      },
      {
        key: 'system',
        title: t('sections.system'),
        icon: IconSettings,
        items: [
          {
            href: '/admin/users',
            label: tCommonEntities('users'),
            icon: IconUsers,
            prefetch: false,
          },
          { href: '/admin/menus', label: tCommon('entities.menus'), icon: IconMenu2 },
          {
            href: '/admin/translations',
            label: tCommonEntities('translations'),
            icon: IconLanguage,
          },
          {
            href: '/admin/settings',
            label: tCommon('labels.settings'),
            icon: IconSettings,
            exact: true,
          },
          { href: '/admin/settings/mail', label: t('items.mailSettings'), icon: IconMailCog },
          { href: '/admin/settings/og-image', label: tCommon('labels.ogImage'), icon: IconPhoto },
          { href: '/admin/terms', label: tCommonEntities('terms'), icon: IconFileText },
          { href: '/admin/privacy', label: tCommonEntities('privacy'), icon: IconFileText },
        ],
      },
    ],
    [t, tCommon, tCommonEntities, tFileManager],
  );

  const navSections = useMemo<AdminNavigationSection[]>(
    () =>
      routeSections.map((section) => ({
        key: section.key,
        title: section.title,
        icon: section.icon,
        items: section.items.map((item) => ({
          href: item.href,
          label: item.label,
          icon: item.icon,
          active: isAdminNavItemActive(pathname, item),
          prefetch: item.prefetch,
        })),
      })),
    [pathname, routeSections],
  );

  useEffect(() => {
    const activeSection = routeSections.find(
      (section) => section.title && section.items.some((item) => isAdminNavItemActive(pathname, item)),
    );

    if (!activeSection) {
      return;
    }

    setOpenSections((previous) => {
      if (previous.has(activeSection.key)) {
        return previous;
      }
      return new Set(previous).add(activeSection.key);
    });
  }, [pathname, routeSections]);

  const handleToggleSection = (sectionKey: string) => {
    setOpenSections((previous) => {
      const next = new Set(previous);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  };

  const navigationMode = isDesktop && desktopNavigationExpanded ? 'expanded' : 'compact';

  return (
    <AdminShellView
      navSections={navSections}
      navigationMode={navigationMode}
      navigationToggleVisible={isDesktop}
      openSectionKeys={[...openSections]}
      colorScheme={mounted ? computedColorScheme : null}
      labels={{
        subtitle: t('subtitle'),
        compactLabel: t('compactLabel'),
        navigation: t('subtitle'),
        toggleNavigation: tCommon('actions.toggleNavigation'),
        toggleColorScheme: tCommon('actions.toggleColorScheme'),
        lightMode: tCommon('theme.lightMode'),
        darkMode: tCommon('theme.darkMode'),
        backToSite: t('actions.backToSite'),
      }}
      events={{
        onToggleNavigation: () => {
          if (isDesktop) {
            setDesktopNavigationExpanded((expanded) => !expanded);
          }
        },
        onToggleSection: handleToggleSection,
        onToggleColorScheme: toggleColorScheme,
        onNavigate: () => undefined,
      }}
      logoSlot={<SiteLogo height={14} />}
      compactLogoSlot={<SiteLogo height={12} />}
      linkComponent={Link}
    >
      {children}
    </AdminShellView>
  );
}
