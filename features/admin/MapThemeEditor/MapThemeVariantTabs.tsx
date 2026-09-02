'use client';

import { useTranslations } from 'next-intl';
import { Tabs } from '@/components/core/Tabs';

export type MapThemeVariantTab = 'light' | 'dark';

export interface MapThemeVariantTabsProps {
  value: MapThemeVariantTab;
  onChange: (value: MapThemeVariantTab) => void;
  disabled?: boolean;
}

export function MapThemeVariantTabs({ value, onChange, disabled = false }: MapThemeVariantTabsProps) {
  const t = useTranslations('adminList.mapThemes.variants');

  return (
    <Tabs value={value} onChange={(nextValue) => onChange((nextValue ?? 'light') as MapThemeVariantTab)}>
      <Tabs.List>
        <Tabs.Tab value="light" disabled={disabled}>
          {t('light')}
        </Tabs.Tab>
        <Tabs.Tab value="dark" disabled={disabled}>
          {t('dark')}
        </Tabs.Tab>
      </Tabs.List>
    </Tabs>
  );
}
