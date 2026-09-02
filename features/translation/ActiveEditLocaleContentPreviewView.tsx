'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Stack, Text } from '@mantine/core';
import { SectionCard } from '@/components/core/Section';

interface Props {
  localeLabel: string;
  hasLiveRow: boolean;
  loading: boolean;
  children: ReactNode;
}

export function ActiveEditLocaleContentPreviewView({ localeLabel, hasLiveRow, loading, children }: Props) {
  const t = useTranslations('translationPanel.activeEditLocale');
  return (
    <SectionCard withBorder p="md" style={{ minHeight: 300 }}>
      <Stack gap="sm">
        <Text size="sm" fw={500}>
          {t('bodyPreviewTitle', { locale: localeLabel })}
        </Text>
        <Text size="xs" c="dimmed">
          {hasLiveRow
            ? t('bodyPreviewDescription', { locale: localeLabel })
            : t('missingDescription', { locale: localeLabel })}
        </Text>
        {loading ? (
          <Text size="sm" c="dimmed">
            {t('loading')}
          </Text>
        ) : (
          children
        )}
      </Stack>
    </SectionCard>
  );
}
