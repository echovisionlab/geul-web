'use client';

import { SupportingText, Text as DsText } from '@/components/core/Typography';
import type { ReactNode } from 'react';

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
      {children ??
        (contentPreview ? (
          <DsText size="sm" tone="secondary">
            {contentPreview}
          </DsText>
        ) : (
          <SupportingText role="status">{t('bodyPreviewEmpty')}</SupportingText>
        ))}
    </ActiveEditLocaleContentPreviewView>
  );
}
