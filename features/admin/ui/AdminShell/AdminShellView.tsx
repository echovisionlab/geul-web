'use client';

import type { ReactNode } from 'react';
import { ApplicationFrame } from '@/components/core/ApplicationFrame';
import type { SideNavigationMode } from '@/components/core/SideNavigation';
import {
  AdminNavigationView,
  type AdminNavigationEvents,
  type AdminNavigationLabels,
  type AdminNavigationSection,
} from '../AdminNavigation';

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
  children,
}: AdminShellViewProps) {
  return (
    <ApplicationFrame
      kind="workspace"
      id="admin-shell"
      data-admin-shell
      data-theme-mode={colorScheme ?? 'pending'}
      navigationMode={navigationMode}
      navigationToggle={
        navigationToggleVisible ? { label: labels.toggleNavigation, onToggle: events.onToggleNavigation } : undefined
      }
      navigation={
        <AdminNavigationView
          sections={navSections}
          mode={navigationMode}
          openSectionKeys={openSectionKeys}
          colorScheme={colorScheme}
          labels={labels}
          events={events}
          logoSlot={logoSlot}
          compactLogoSlot={compactLogoSlot}
        />
      }
    >
      {children}
    </ApplicationFrame>
  );
}
