'use client';

import { useTranslations } from 'next-intl';
import { Tabs } from '@/components/core/Tabs';

export type MapThemeVariantTab = 'light' | 'dark';

export interface MapThemeVariantTabsProps {
  value: MapThemeVariantTab;
  onChange: (value: MapThemeVariantTab) => void;
  disabled?: boolean;
  panelId: string;
  tabIds: Record<MapThemeVariantTab, string>;
}

export function MapThemeVariantTabs({ value, onChange, disabled = false, panelId, tabIds }: MapThemeVariantTabsProps) {
  const t = useTranslations('adminList.mapThemes.variants');
  const tMapFields = useTranslations('mapControls.fields');

  return (
    <Tabs
      aria-label={tMapFields('colorScheme')}
      value={value}
      onChange={(nextValue) => onChange((nextValue ?? 'light') as MapThemeVariantTab)}
    >
      <Tabs.List>
        <Tabs.Tab value="light" disabled={disabled} externalPanel={{ id: panelId, tabId: tabIds.light }}>
          {t('light')}
        </Tabs.Tab>
        <Tabs.Tab value="dark" disabled={disabled} externalPanel={{ id: panelId, tabId: tabIds.dark }}>
          {t('dark')}
        </Tabs.Tab>
      </Tabs.List>
    </Tabs>
  );
}
