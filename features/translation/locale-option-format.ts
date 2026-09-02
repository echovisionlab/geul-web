'use client';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { normalizeLocale } from '@/lib/i18n/locale';

export interface TranslationLocaleSelectOption {
  value: string;
  label: string;
  isSource?: boolean;
}

function getSourceTranslationLocaleOptionLabel(option: TranslationLocaleSelectOption): string {
  const codeSuffix = ` (${option.value})`;
  if (option.label.endsWith(codeSuffix)) {
    return option.label.slice(0, -codeSuffix.length);
  }

  return option.label;
}

function isSourceTranslationLocaleOption(
  option: TranslationLocaleSelectOption,
  sourceLocale: string | null | undefined,
): boolean {
  if (option.isSource) {
    return true;
  }

  const normalizedValue = normalizeLocale(option.value);
  const normalizedSourceLocale = normalizeLocale(sourceLocale);

  return normalizedValue != null && normalizedValue === normalizedSourceLocale;
}

export function partitionTranslationLocaleOptions(
  options: readonly TranslationLocaleSelectOption[],
  sourceLocale: string | null | undefined,
) {
  let sourceOption: TranslationLocaleSelectOption | null = null;
  const translationOptions: TranslationLocaleSelectOption[] = [];

  for (const option of options) {
    if (!sourceOption && isSourceTranslationLocaleOption(option, sourceLocale)) {
      sourceOption = option;
      continue;
    }

    translationOptions.push(option);
  }

  return { sourceOption, translationOptions };
}

export function useFormatTranslationLocaleOptionLabel() {
  const t = useTranslations('translationPanel.activeEditLocale');

  return useCallback(
    (option: TranslationLocaleSelectOption, sourceLocale: string | null | undefined) =>
      isSourceTranslationLocaleOption(option, sourceLocale)
        ? t('sourceOption', { locale: getSourceTranslationLocaleOptionLabel(option) })
        : option.label,
    [t],
  );
}

export function useTranslationLocaleSelectData(
  options: readonly TranslationLocaleSelectOption[],
  sourceLocale: string | null | undefined,
) {
  const formatOptionLabel = useFormatTranslationLocaleOptionLabel();

  return useMemo(
    () =>
      options.map((option) => ({
        value: option.value,
        label: formatOptionLabel(option, sourceLocale),
      })),
    [formatOptionLabel, options, sourceLocale],
  );
}
