'use client';

import { useMemo, type ComponentType, type ElementType, type ReactNode } from 'react';
import { IconArrowLeft, IconMoon, IconSun, IconSunMoon, type IconProps } from '@tabler/icons-react';
import { Stack, Text } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { SideNavigation, type SideNavigationMode, type SideNavigationSection } from '@/components/core/SideNavigation';
import { Tooltip } from '@/components/core/Tooltip';
import classes from './AdminNavigationView.module.css';

export interface AdminNavigationItem {
  href: string;
  label: string;
  icon: ComponentType<IconProps>;
  active: boolean;
  prefetch?: boolean;
}

export interface AdminNavigationSection {
  key: string;
  title?: string;
  icon?: ComponentType<IconProps>;
  items: AdminNavigationItem[];
}

export interface AdminNavigationLabels {
  subtitle: string;
  compactLabel: string;
  navigation: string;
  toggleColorScheme: string;
  lightMode: string;
  darkMode: string;
  backToSite: string;
}

export interface AdminNavigationEvents {
  onToggleSection: (sectionKey: string) => void;
  onToggleColorScheme: () => void;
  onNavigate: (href: string) => void;
}

export interface AdminNavigationViewProps {
  sections: AdminNavigationSection[];
  mode: SideNavigationMode;
  openSectionKeys: readonly string[];
  colorScheme: 'light' | 'dark' | null;
  labels: AdminNavigationLabels;
  events: AdminNavigationEvents;
  logoSlot: ReactNode;
  compactLogoSlot: ReactNode;
  linkComponent?: ElementType;
}

/** Pure admin navigation composition. Routing, translations, and responsive state live in its controller. */
export function AdminNavigationView({
  sections,
  mode,
  openSectionKeys,
  colorScheme,
  labels,
  events,
  logoSlot,
  compactLogoSlot,
  linkComponent,
}: AdminNavigationViewProps) {
  const LinkComponent = linkComponent ?? 'a';
  const compact = mode === 'compact';
  const themeTooltip =
    colorScheme === 'dark' ? labels.lightMode : colorScheme === 'light' ? labels.darkMode : labels.toggleColorScheme;
  const themeIcon =
    colorScheme === 'dark' ? (
      <IconSun size={16} aria-hidden />
    ) : colorScheme === 'light' ? (
      <IconMoon size={16} aria-hidden />
    ) : (
      <IconSunMoon size={16} aria-hidden />
    );
  const navigationSections = useMemo<SideNavigationSection[]>(
    () =>
      sections.map((section) => {
        const SectionIcon = section.icon;

        return {
          key: section.key,
          label: section.title,
          icon: SectionIcon ? <SectionIcon size={16} stroke={1.5} aria-hidden /> : undefined,
          items: section.items.map((item) => ({
            key: item.href,
            href: item.href,
            label: item.label,
            icon: <item.icon size={16} stroke={1.5} aria-hidden />,
            active: item.active,
            prefetch: item.prefetch,
          })),
        };
      }),
    [sections],
  );

  const logoLink = (
    <LinkComponent
      href="/admin"
      className={classes.logoLink}
      aria-label={compact ? labels.compactLabel : undefined}
      onClick={() => events.onNavigate('/admin')}
    >
      {compact ? compactLogoSlot : logoSlot}
      {compact ? null : (
        <Text size="xs" c="dimmed" fw={500} mt={4}>
          {labels.subtitle}
        </Text>
      )}
    </LinkComponent>
  );

  return (
    <div className={classes.root} data-admin-navigation data-mode={mode}>
      <header className={classes.header}>{compact ? <Stack align="center">{logoLink}</Stack> : logoLink}</header>

      <div className={classes.navigationViewport} data-admin-navigation-viewport>
        <SideNavigation
          ariaLabel={labels.navigation}
          sections={navigationSections}
          mode={mode}
          showExpandedIcons={false}
          openSectionKeys={openSectionKeys}
          linkComponent={LinkComponent}
          onToggleSection={events.onToggleSection}
          onSelectItem={(item) => events.onNavigate(item.href)}
        />
      </div>

      <footer className={classes.footer}>
        {compact ? (
          <>
            <Tooltip label={themeTooltip}>
              <IconButton
                size={40}
                tone="neutral"
                emphasis="low"
                onClick={events.onToggleColorScheme}
                aria-label={labels.toggleColorScheme}
              >
                {themeIcon}
              </IconButton>
            </Tooltip>
            <Tooltip label={labels.backToSite}>
              <IconButton
                component={LinkComponent as 'a'}
                href="/"
                size={40}
                tone="neutral"
                emphasis="low"
                aria-label={labels.backToSite}
                onClick={() => events.onNavigate('/')}
              >
                <IconArrowLeft size={16} aria-hidden />
              </IconButton>
            </Tooltip>
          </>
        ) : (
          <>
            <Button
              type="button"
              size="xs"
              fullWidth
              justify="flex-start"
              tone="neutral"
              emphasis="low"
              className={classes.footerAction}
              onClick={events.onToggleColorScheme}
              aria-label={labels.toggleColorScheme}
              data-admin-navigation-action="theme"
            >
              {themeTooltip}
            </Button>
            <Button
              component={LinkComponent as 'a'}
              href="/"
              size="xs"
              fullWidth
              justify="flex-start"
              tone="neutral"
              emphasis="low"
              className={classes.footerAction}
              onClick={() => events.onNavigate('/')}
              data-admin-navigation-action="back"
            >
              {labels.backToSite}
            </Button>
          </>
        )}
      </footer>
    </div>
  );
}
