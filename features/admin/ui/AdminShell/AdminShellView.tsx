'use client';

import type { ElementType, ReactNode } from 'react';
import { AppShell } from '@mantine/core';
import type { SideNavigationMode } from '@/components/core/SideNavigation';
import {
  AdminNavigationView,
  type AdminNavigationEvents,
  type AdminNavigationLabels,
  type AdminNavigationSection,
} from '../AdminNavigation';
import classes from './AdminShellView.module.css';

export interface AdminShellViewLabels extends AdminNavigationLabels {
  toggleNavigation: string;
}

export interface AdminShellViewEvents extends AdminNavigationEvents {
  onToggleNavigation: () => void;
}

export interface AdminShellViewProps {
  navSections: AdminNavigationSection[];
  navigationMode: SideNavigationMode;
  navigationToggleVisible: boolean;
  openSectionKeys: readonly string[];
  colorScheme: 'light' | 'dark' | null;
  labels: AdminShellViewLabels;
  events: AdminShellViewEvents;
  logoSlot: ReactNode;
  compactLogoSlot: ReactNode;
  linkComponent?: ElementType;
  children: ReactNode;
}

/** Pure admin shell frame. Navigation composition, routing, translations, and responsive state are external. */
export function AdminShellView({
  navSections,
  navigationMode,
  navigationToggleVisible,
  openSectionKeys,
  colorScheme,
  labels,
  events,
  logoSlot,
  compactLogoSlot,
  linkComponent,
  children,
}: AdminShellViewProps) {
  const navigationWidth = navigationMode === 'expanded' ? 224 : 48;

  return (
    <AppShell
      id="admin-shell"
      className={classes.root}
      padding="md"
      navbar={{ width: navigationWidth, breakpoint: 0 }}
      data-admin-shell
      data-navigation-mode={navigationMode}
      data-theme-mode={colorScheme ?? 'pending'}
    >
      <AppShell.Navbar
        component="aside"
        p={navigationMode === 'expanded' ? 'xs' : 3}
        className={classes.navbar}
        data-admin-shell-navbar
      >
        <AdminNavigationView
          sections={navSections}
          mode={navigationMode}
          openSectionKeys={openSectionKeys}
          colorScheme={colorScheme}
          labels={labels}
          events={events}
          logoSlot={logoSlot}
          compactLogoSlot={compactLogoSlot}
          linkComponent={linkComponent}
        />
        {navigationToggleVisible ? (
          <button
            type="button"
            className={classes.edgeToggle}
            aria-label={labels.toggleNavigation}
            aria-expanded={navigationMode === 'expanded'}
            onClick={events.onToggleNavigation}
            data-admin-navigation-edge-toggle
          />
        ) : null}
      </AppShell.Navbar>

      <AppShell.Main className={classes.main} data-admin-shell-main>
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
