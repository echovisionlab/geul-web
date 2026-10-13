'use client';

import { formatLocaleCode } from '@/components/core/Typography/locale-code';
import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { IconLanguage } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { normalizeLocale } from '@/lib/i18n/locale';
import { buildContentLanguageHref } from '@/lib/translation/content-language';
interface LegalLocalizationInfoLike {
  displayedLocale?: string | null;
  sourceLocale?: string | null;
}
export function LegalTranslationNotice({
  pathname,
  query,
  localizationInfo,
}: {
  pathname: string;
  query?: Record<string, string | string[] | undefined>;
  localizationInfo?: LegalLocalizationInfoLike | null;
}) {
  const t = useTranslations('localizationNotice');
  const sourceLocale = normalizeLocale(localizationInfo?.sourceLocale);
  const displayedLocale = normalizeLocale(localizationInfo?.displayedLocale);
  if (!sourceLocale || !displayedLocale || sourceLocale === displayedLocale) {
    return null;
  }
  return (
    <Alert icon={<IconLanguage size={16} />} tone="accent">
      <DsLayoutInline justify="between" align="center" wrap="wrap">
        <DsText weight="strong" lang="ko">
          참고 번역이며 원문이 우선합니다
        </DsText>
        <Button
          href={buildContentLanguageHref(pathname, query, { requestedLocale: sourceLocale })}
          size="xs"
          emphasis="low"
          printVisibility="hidden"
        >
          {t('actions.viewOriginal', { source: formatLocaleCode(sourceLocale) })}
        </Button>
      </DsLayoutInline>
    </Alert>
  );
}
