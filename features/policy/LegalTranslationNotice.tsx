'use client';

import Link from 'next/link';
import { IconLanguage } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Group, Text } from '@mantine/core';
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
      <Group justify="space-between" align="center" wrap="wrap">
        <Text fw={600}>참고 번역이며 원문이 우선합니다</Text>
        <Button
          component={Link}
          href={buildContentLanguageHref(pathname, query, { requestedLocale: sourceLocale })}
          size="xs"
          emphasis="low"
          className="print-hide"
        >
          {t('actions.viewOriginal', { source: sourceLocale })}
        </Button>
      </Group>
    </Alert>
  );
}
