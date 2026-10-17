import type { ReactNode } from 'react';
import { LayoutStack } from '../Layout';
import { SectionHeader } from './SectionHeader';

export interface SettingsSectionProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * One section of a settings page outline (h2). Sections are separated by the page's
 * section gap; inside, fields and groups share one rhythm. Use SettingsGroup (h3) for a
 * named subset; do not nest sections or repeat the section title in a child label.
 */
export function SettingsSection({ title, description, actions, children }: SettingsSectionProps) {
  return (
    <LayoutStack as="section" gap="lg">
      <SectionHeader level={2} title={title} description={description} actions={actions} />
      {children}
    </LayoutStack>
  );
}

export type SettingsGroupProps = SettingsSectionProps;

/** A named group of fields inside a SettingsSection (h3). */
export function SettingsGroup({ title, description, actions, children }: SettingsGroupProps) {
  return (
    <LayoutStack as="section" gap="md">
      <SectionHeader level={3} title={title} description={description} actions={actions} />
      {children}
    </LayoutStack>
  );
}
