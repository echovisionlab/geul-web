'use client';

import { PageLoader } from '@/features/site/PageLoader';
import { Text as DsText } from '@/components/core/Typography';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';

import { useId, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { SectionCard } from '@/components/core/Section';

interface Props {
  localeLabel: string;
  hasLiveRow: boolean;
  loading: boolean;
  children: ReactNode;
}

export function ActiveEditLocaleContentPreviewView({ localeLabel, hasLiveRow, loading, children }: Props) {
  const t = useTranslations('translationPanel.activeEditLocale');
  const titleId = useId();
  const descriptionId = useId();
  return (
    <div style={{ minHeight: 300 }}>
      <SectionCard
        withBorder
        padding="md"
        role="group"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={loading}
      >
        <DsLayoutStack gap="sm">
          <DsText id={titleId} size="sm" weight="medium">
            {t('bodyPreviewTitle', { locale: localeLabel })}
          </DsText>
          <DsText id={descriptionId} size="xs" tone="secondary">
            {hasLiveRow
              ? t('bodyPreviewDescription', { locale: localeLabel })
              : t('missingDescription', { locale: localeLabel })}
          </DsText>
          {loading ? <PageLoader placement="flow" message={t('loading')} /> : children}
        </DsLayoutStack>
      </SectionCard>
    </div>
  );
}
