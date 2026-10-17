'use client';

import { Text as DsText } from '@/components/core/Typography';
import { LayoutInset as DsLayoutInset, LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { useMemo, type ComponentType, type ReactNode } from 'react';
import { IconArrowLeft, IconMoon, IconSun, IconSunMoon, type IconProps } from '@tabler/icons-react';

import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { SideNavigation, type SideNavigationMode, type SideNavigationSection } from '@/components/core/SideNavigation';
import { Tooltip } from '@/components/core/Tooltip';
import Link from '@/components/core/Navigation';
import { SectionCard } from '@/components/core/Section';
import { Separator, ScrollArea } from '@/components/core/Display';
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
}: AdminNavigationViewProps) {
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
    <Link
      href="/admin"
      appearance="block"
      aria-label={compact ? labels.compactLabel : undefined}
      onClick={() => events.onNavigate('/admin')}
    >
      {/* Brand and subtitle start on the navigation labels' `xs` line. */}
      <DsLayoutInset inline={compact ? 'none' : 'xs'}>{compact ? compactLogoSlot : logoSlot}</DsLayoutInset>
      {compact ? null : (
        <DsLayoutInset inline="xs" blockStart="xxs">
          <DsText size="xs" tone="secondary" weight="medium">
            {labels.subtitle}
          </DsText>
        </DsLayoutInset>
      )}
    </Link>
  );

  return (
    <div className={classes.root} data-admin-navigation data-mode={mode}>
      <header>
        <SectionCard padding="none" border="block-end" appearance="plain">
          <DsLayoutInset block="xxs">
            {compact ? <DsLayoutStack align="center">{logoLink}</DsLayoutStack> : logoLink}
          </DsLayoutInset>
        </SectionCard>
      </header>

      <ScrollArea grow scrollbars="y" data-admin-navigation-viewport>
        <SideNavigation
          ariaLabel={labels.navigation}
          sections={navigationSections}
          mode={mode}
          showExpandedIcons={false}
          openSectionKeys={openSectionKeys}
          onToggleSection={events.onToggleSection}
          onSelectItem={(item) => events.onNavigate(item.href)}
        />
      </ScrollArea>

      <Separator />
      <DsLayoutInset as="footer" blockStart="xxs">
        <DsLayoutStack gap="none" align={compact ? 'center' : 'stretch'}>
          {compact ? (
            <>
              <Tooltip label={themeTooltip}>
                <IconButton
                  size="chrome"
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
                  href="/"
                  size="chrome"
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
                justify="start"
                tone="neutral"
                emphasis="low"
                onClick={events.onToggleColorScheme}
                aria-label={labels.toggleColorScheme}
                data-admin-navigation-action="theme"
              >
                {themeTooltip}
              </Button>
              <Button
                href="/"
                size="xs"
                fullWidth
                justify="start"
                tone="neutral"
                emphasis="low"
                onClick={() => events.onNavigate('/')}
                data-admin-navigation-action="back"
              >
                {labels.backToSite}
              </Button>
            </>
          )}
        </DsLayoutStack>
      </DsLayoutInset>
    </div>
  );
}
