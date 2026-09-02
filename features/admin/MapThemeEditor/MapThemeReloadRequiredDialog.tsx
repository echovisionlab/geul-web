'use client';

import { useTranslations } from 'next-intl';
import { BlockingAlertDialog } from '@/components/core';

export interface MapThemeReloadRequiredDialogProps {
  opened: boolean;
  onReload: () => void;
}

export function MapThemeReloadRequiredDialog({ opened, onReload }: MapThemeReloadRequiredDialogProps) {
  const t = useTranslations('adminList.mapThemes.reloadRequired');

  return (
    <BlockingAlertDialog
      opened={opened}
      onAction={onReload}
      title={t('title')}
      message={t('message')}
      actionLabel={t('action')}
      level="warning"
      size="compact"
    />
  );
}
