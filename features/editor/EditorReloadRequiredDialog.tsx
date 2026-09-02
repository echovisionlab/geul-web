'use client';

import { useTranslations } from 'next-intl';
import { BlockingAlertDialog } from '@/components/core';

export interface EditorReloadRequiredDialogProps {
  opened: boolean;
  onReload: () => void;
}

export function EditorReloadRequiredDialog({ opened, onReload }: EditorReloadRequiredDialogProps) {
  const t = useTranslations('editorCommon.reloadRequired');

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
