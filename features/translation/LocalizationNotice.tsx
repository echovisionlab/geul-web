'use client';

import { useTranslations } from 'next-intl';
import { getSupportedLocaleOptions, normalizeLocale } from '@/lib/i18n/locale';
import { buildContentLanguageHref } from '@/lib/translation/content-language';
import { LocalizationNoticeClient } from './LocalizationNoticeClient';

interface LocalizationInfoLike {
  displayedLocale?: string | null;
  sourceLocale?: string | null;
  isFallback?: boolean;
}

interface LocalizationNoticeProps {
  pathname: string;
  query?: Record<string, string | string[] | undefined>;
  requestedLocale: string;
  localizationInfo?: LocalizationInfoLike | null;
  variant?: 'subtle' | 'banner';
  onRequestedLocaleChange?: (locale: string) => void;
}

function buildDismissKey(input: {
  pathname: string;
  requestedLocale: string;
  displayedLocale: string;
  sourceLocale: string;
}) {
  return [
    'translation-notice',
    input.pathname,
    input.requestedLocale,
    input.displayedLocale,
    input.sourceLocale,
    input.displayedLocale === input.sourceLocale ? 'source' : 'localized',
  ].join(':');
}

function getLocaleLabel(locale: string | null | undefined): string {
  const normalized = normalizeLocale(locale);
  if (!normalized) {
    return locale?.trim() || 'Unknown';
  }

  return getSupportedLocaleOptions().find((option) => option.value === normalized)?.label ?? normalized;
}

export function LocalizationNotice({
  pathname,
  query,
  requestedLocale,
  localizationInfo,
  variant = 'subtle',
  onRequestedLocaleChange,
}: LocalizationNoticeProps) {
  const t = useTranslations('localizationNotice');
  const tCommon = useTranslations('common.actions');

  const effectiveRequested = normalizeLocale(requestedLocale) ?? 'en';
  const effectiveDisplayed = normalizeLocale(localizationInfo?.displayedLocale) ?? effectiveRequested;
  const effectiveSource = normalizeLocale(localizationInfo?.sourceLocale) ?? effectiveDisplayed;
  const isFallback = Boolean(localizationInfo?.isFallback);
  const showsTranslatedLocale = effectiveDisplayed !== effectiveSource;
  const shouldShow = isFallback || showsTranslatedLocale;

  if (!shouldShow) {
    return null;
  }

  const sourceLabel = getLocaleLabel(effectiveSource);
  const displayedLabel = getLocaleLabel(effectiveDisplayed);
  const requestedLabel = getLocaleLabel(effectiveRequested);

  let title = t('fallback.title');
  let description = t('fallback.source', {
    requested: requestedLabel,
    displayed: displayedLabel,
    source: sourceLabel,
  });

  if (!isFallback && showsTranslatedLocale) {
    title = t('translated.title');
    description = t('translated.description', {
      displayed: displayedLabel,
      source: sourceLabel,
    });
  }

  const dismissKey = buildDismissKey({
    pathname,
    requestedLocale: effectiveRequested,
    displayedLocale: effectiveDisplayed,
    sourceLocale: effectiveSource,
  });

  return (
    <LocalizationNoticeClient
      dismissKey={dismissKey}
      variant={variant}
      title={title}
      description={description}
      tone="accent"
      dismissLabel={tCommon('dismiss')}
      originalHref={
        showsTranslatedLocale
          ? buildContentLanguageHref(pathname, query, {
              requestedLocale: effectiveSource,
            })
          : null
      }
      originalLabel={showsTranslatedLocale ? t('actions.viewOriginal', { source: sourceLabel }) : null}
      onOriginalClick={
        showsTranslatedLocale && onRequestedLocaleChange ? () => onRequestedLocaleChange(effectiveSource) : undefined
      }
      translatedHref={null}
      translatedLabel={null}
    />
  );
}
