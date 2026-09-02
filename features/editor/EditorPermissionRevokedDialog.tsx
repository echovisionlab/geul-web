'use client';

import { useTranslations } from 'next-intl';
import { BlockingAlertDialog } from '@/components/core';

export interface EditorPermissionRevokedDialogProps {
  opened: boolean;
  onConfirm: () => void;
  loading?: boolean;
}

export function EditorPermissionRevokedDialog({
  opened,
  onConfirm,
  loading = false,
}: EditorPermissionRevokedDialogProps) {
  const t = useTranslations('editorCommon.permissionRevoked');
  const tActions = useTranslations('common.actions');

  return (
    <BlockingAlertDialog
      opened={opened}
      onAction={onConfirm}
      title={t('title')}
      message={t('message')}
      actionLabel={tActions('confirm')}
      level="warning"
      loading={loading}
      size="compact"
    />
  );
}
