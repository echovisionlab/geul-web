'use client';

import {
  LayoutStack as DsLayoutStack,
  LayoutInset as DsLayoutInset,
  LayoutInline as DsLayoutInline,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { Select, ColorInput, NumberInput } from '@/components/core/Input';
import type { PageSectionMaxWidth } from '@/features/editor/contract/localized-page';
import type { SectionSettings } from './types';

interface SectionSettingsFormProps {
  settings: SectionSettings;
  onChange: (settings: Partial<SectionSettings>) => void;
  readOnly?: boolean;
}

/** Section width choices, in the order of the stored values. */
export function usePageSectionMaxWidthOptions(): { value: PageSectionMaxWidth; label: string }[] {
  const t = useTranslations('pageEditor');
  return useMemo(
    () => [
      { value: 'full', label: t('sectionItem.maxWidth.full') },
      { value: 'container', label: t('sectionItem.maxWidth.container') },
      { value: 'narrow', label: t('sectionItem.maxWidth.narrow') },
    ],
    [t],
  );
}

export function SectionSettingsForm({ settings, onChange, readOnly = false }: SectionSettingsFormProps) {
  const t = useTranslations('pageEditor');
  const tCommonLabels = useTranslations('common.labels');
  const maxWidthOptions = usePageSectionMaxWidthOptions();
  const handleChange = useCallback(
    <K extends keyof SectionSettings>(key: K, value: SectionSettings[K]) => {
      if (!readOnly) {
        onChange({ [key]: value });
      }
    },
    [onChange, readOnly],
  );

  return (
    <DsLayoutStack gap="sm">
      <ColorInput
        disabled={readOnly}
        label={tCommonLabels('background')}
        value={settings.backgroundColor || ''}
        onChange={(value) => handleChange('backgroundColor', value)}
        placeholder={t('sectionItem.settings.backgroundPlaceholder')}
        size="xs"
      />

      <Select
        disabled={readOnly}
        label={t('sectionItem.settings.maxWidth')}
        data={maxWidthOptions}
        // Unset renders full width (schema and renderer default), so the field shows that value.
        value={settings.maxWidth || 'full'}
        onChange={(value) => handleChange('maxWidth', (value as PageSectionMaxWidth | null) || 'full')}
        size="xs"
      />

      <DsLayoutInset blockStart="xs">
        <DsText size="xs" tone="secondary">
          {t('sectionItem.settings.padding')}
        </DsText>
      </DsLayoutInset>
      <DsLayoutInline grow>
        <NumberInput
          disabled={readOnly}
          label={tCommonLabels('top')}
          value={parseInt(settings.paddingTop || '48', 10)}
          onChange={(value) => handleChange('paddingTop', String(value || 0))}
          min={0}
          max={200}
          size="xs"
        />
        <NumberInput
          disabled={readOnly}
          label={tCommonLabels('bottom')}
          value={parseInt(settings.paddingBottom || '48', 10)}
          onChange={(value) => handleChange('paddingBottom', String(value || 0))}
          min={0}
          max={200}
          size="xs"
        />
      </DsLayoutInline>
      <DsLayoutInline grow>
        <NumberInput
          disabled={readOnly}
          label={tCommonLabels('left')}
          value={parseInt(settings.paddingLeft || '24', 10)}
          onChange={(value) => handleChange('paddingLeft', String(value || 0))}
          min={0}
          max={200}
          size="xs"
        />
        <NumberInput
          disabled={readOnly}
          label={tCommonLabels('right')}
          value={parseInt(settings.paddingRight || '24', 10)}
          onChange={(value) => handleChange('paddingRight', String(value || 0))}
          min={0}
          max={200}
          size="xs"
        />
      </DsLayoutInline>
    </DsLayoutStack>
  );
}
