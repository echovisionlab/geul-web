'use client';

import { IconLanguage } from '@tabler/icons-react';
import { useLocale, useTranslations } from 'next-intl';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { LayoutInline } from '@/components/core/Layout';
import { Text } from '@/components/core/Typography';
import { formatLocaleCode } from '@/components/core/Typography/locale-code';
import { normalizeLocale } from '@/lib/i18n/locale';
import { buildContentLanguageHref } from '@/lib/translation/content-language';

interface LocalizationInfoLike {
  requestedLocale?: string | null;
  displayedLocale?: string | null;
  sourceLocale?: string | null;
}

interface ContentLocaleNoticeProps {
  pathname: string;
  query?: Record<string, string | string[] | undefined>;
  localizationInfo?: LocalizationInfoLike | null;
  /** Also say that a translation is shown and the original prevails (legal documents). */
  announceTranslation?: boolean;
}

function languageName(code: string, interfaceLocale: string): string {
  try {
    return new Intl.DisplayNames([interfaceLocale], { type: 'language' }).of(code) ?? formatLocaleCode(code);
  } catch {
    return formatLocaleCode(code);
  }
}

/**
 * Tells the reader, in the interface language, when the document is shown in another language than
 * the one they asked for (no translation yet) and, where announced, when a translation is shown.
 */
export function ContentLocaleNotice({
  pathname,
  query,
  localizationInfo,
  announceTranslation = false,
}: ContentLocaleNoticeProps) {
  const t = useTranslations('localizationNotice');
  const interfaceLocale = useLocale();
  const requestedLocale = normalizeLocale(localizationInfo?.requestedLocale);
  const displayedLocale = normalizeLocale(localizationInfo?.displayedLocale);
  const sourceLocale = normalizeLocale(localizationInfo?.sourceLocale);
  if (!displayedLocale || !sourceLocale) {
    return null;
  }
  // The reader asked for a language this document has no version in yet.
  const unavailableLocale = requestedLocale && requestedLocale !== displayedLocale ? requestedLocale : null;
  const translated = displayedLocale !== sourceLocale;
  if (!unavailableLocale && !(announceTranslation && translated)) {
    return null;
  }
  const name = (locale: string) => languageName(locale, interfaceLocale);
  const message = unavailableLocale
    ? t('fallback.description', { requested: name(unavailableLocale), displayed: name(displayedLocale) })
    : t('translated.description', { displayed: name(displayedLocale), source: name(sourceLocale) });

  return (
    <Alert icon={<IconLanguage size={16} />} tone="accent">
      <LayoutInline justify="between" align="center" wrap="wrap">
        <Text weight="strong">{message}</Text>
        {translated ? (
          <Button
            href={buildContentLanguageHref(pathname, query, { requestedLocale: sourceLocale })}
            size="xs"
            emphasis="low"
            printVisibility="hidden"
          >
            {t('actions.viewOriginal', { source: formatLocaleCode(sourceLocale) })}
          </Button>
        ) : null}
      </LayoutInline>
    </Alert>
  );
}
