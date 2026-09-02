'use client';

import { useTranslations } from 'next-intl';
import { BlockingAlertDialog } from '@/components/core';

export interface EditorSessionExpiredDialogProps {
  opened: boolean;
  onConfirm: () => void;
}

export function EditorSessionExpiredDialog({ opened, onConfirm }: EditorSessionExpiredDialogProps) {
  const t = useTranslations('editorCommon.sessionExpired');
  const tActions = useTranslations('common.actions');

  return (
    <BlockingAlertDialog
      opened={opened}
      onAction={onConfirm}
      title={t('title')}
      message={t('message')}
      actionLabel={tActions('logIn')}
      level="warning"
      size="compact"
    />
  );
}
