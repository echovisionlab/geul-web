'use client';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { getSupportedLocaleOptions, normalizeLocale } from '@/lib/i18n/locale';

export function useSharedTranslationStatusLabel() {
  const tLabels = useTranslations('common.labels');
  const tStatuses = useTranslations('common.statuses');

  return useCallback(
    (status: string) => {
      switch (status) {
        case 'source':
          return tLabels('source');
        case 'queued':
        case 'running':
          return tStatuses(status);
        default:
          return null;
      }
    },
    [tLabels, tStatuses],
  );
}

export function useTranslationLocaleLabels(
  sourceLocale: string | undefined,
  localeDefinitions: ReadonlyArray<{ code: string }>,
) {
  const supportedLocaleOptions = useMemo(() => getSupportedLocaleOptions(), []);
  const getLocaleDisplayLabel = useCallback(
    (code: string) => {
      const normalizedLocale = normalizeLocale(code);
      if (!normalizedLocale) {
        return code;
      }
      return supportedLocaleOptions.find((option) => option.value === normalizedLocale)?.label ?? normalizedLocale;
    },
    [supportedLocaleOptions],
  );
  const localeOptions = useMemo(() => {
    const codes = [sourceLocale, ...localeDefinitions.map((definition) => definition.code)].filter(
      (code): code is string => Boolean(code),
    );
    return [...new Set(codes)].map((code) => ({
      value: code,
      label: `${getLocaleDisplayLabel(code)} (${code})`,
      isSource: code === sourceLocale,
    }));
  }, [getLocaleDisplayLabel, localeDefinitions, sourceLocale]);

  return { getLocaleDisplayLabel, localeOptions };
}
