'use client';

import type { ReactNode } from 'react';
import { Text } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { ActiveEditLocaleContentPreviewView } from './ActiveEditLocaleContentPreviewView';

interface ActiveEditLocaleContentPreviewProps {
  localeLabel: string;
  hasLiveRow: boolean;
  contentPreview: string;
  loading?: boolean;
  children?: ReactNode;
}

export function ActiveEditLocaleContentPreview({
  localeLabel,
  hasLiveRow,
  contentPreview,
  loading = false,
  children,
}: ActiveEditLocaleContentPreviewProps) {
  const t = useTranslations('translationPanel.activeEditLocale');
  return (
    <ActiveEditLocaleContentPreviewView localeLabel={localeLabel} hasLiveRow={hasLiveRow} loading={loading}>
      {children ?? (
        <Text size="sm" c="dimmed" role="status">
          {contentPreview || t('bodyPreviewEmpty')}
        </Text>
      )}
    </ActiveEditLocaleContentPreviewView>
  );
}
