'use client';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Group, Stack, Text } from '@mantine/core';
import { Select, ColorInput, NumberInput } from '@/components/core/Input';
import type { SectionSettings } from './types';

interface SectionSettingsFormProps {
  settings: SectionSettings;
  onChange: (settings: Partial<SectionSettings>) => void;
}

export function SectionSettingsForm({ settings, onChange }: SectionSettingsFormProps) {
  const t = useTranslations('pageEditor');
  const tCommonLabels = useTranslations('common.labels');
  const maxWidthOptions = useMemo(
    () => [
      { value: 'full', label: t('sectionItem.maxWidth.full') },
      { value: 'container', label: t('sectionItem.maxWidth.container') },
      { value: 'narrow', label: t('sectionItem.maxWidth.narrow') },
    ],
    [t],
  );
  const handleChange = useCallback(
    <K extends keyof SectionSettings>(key: K, value: SectionSettings[K]) => {
      onChange({ [key]: value });
    },
    [onChange],
  );

  return (
    <Stack gap="sm">
      <ColorInput
        label={tCommonLabels('background')}
        value={settings.backgroundColor || ''}
        onChange={(value) => handleChange('backgroundColor', value)}
        placeholder={t('sectionItem.settings.backgroundPlaceholder')}
        size="xs"
      />

      <Select
        label={t('sectionItem.settings.maxWidth')}
        data={maxWidthOptions}
        value={settings.maxWidth || 'container'}
        onChange={(value) => handleChange('maxWidth', (value as 'full' | 'container' | 'narrow') || 'container')}
        size="xs"
      />

      <Text size="xs" c="dimmed" mt="xs">
        {t('sectionItem.settings.padding')}
      </Text>
      <Group grow>
        <NumberInput
          label={tCommonLabels('top')}
          value={parseInt(settings.paddingTop || '48', 10)}
          onChange={(value) => handleChange('paddingTop', String(value || 0))}
          min={0}
          max={200}
          size="xs"
        />
        <NumberInput
          label={tCommonLabels('bottom')}
          value={parseInt(settings.paddingBottom || '48', 10)}
          onChange={(value) => handleChange('paddingBottom', String(value || 0))}
          min={0}
          max={200}
          size="xs"
        />
      </Group>
      <Group grow>
        <NumberInput
          label={tCommonLabels('left')}
          value={parseInt(settings.paddingLeft || '24', 10)}
          onChange={(value) => handleChange('paddingLeft', String(value || 0))}
          min={0}
          max={200}
          size="xs"
        />
        <NumberInput
          label={tCommonLabels('right')}
          value={parseInt(settings.paddingRight || '24', 10)}
          onChange={(value) => handleChange('paddingRight', String(value || 0))}
          min={0}
          max={200}
          size="xs"
        />
      </Group>
    </Stack>
  );
}
