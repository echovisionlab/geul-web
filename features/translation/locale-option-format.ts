'use client';

import { formatLocaleCode } from '@/components/core/Typography/locale-code';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { normalizeLocale } from '@/lib/i18n/locale';

export interface TranslationLocaleSelectOption {
  value: string;
  label: string;
  isSource?: boolean;
}

export function getTranslationLocaleOptionName(option: TranslationLocaleSelectOption): string {
  const suffix = option.label.match(/ \(([^()]+)\)$/);
  return suffix && formatLocaleCode(suffix[1]) === formatLocaleCode(option.value)
    ? option.label.slice(0, -suffix[0].length)
    : option.label;
}

function getLocaleOptionLabel(option: TranslationLocaleSelectOption): string {
  return getTranslationLocaleOptionName(option);
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
        ? t('sourceOption', { locale: getTranslationLocaleOptionName(option) })
        : getLocaleOptionLabel(option),
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
