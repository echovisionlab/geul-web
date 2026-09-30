'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Stack, Text } from '@mantine/core';
import { BlockingAlertDialog } from '@/components/core';

export interface EditorReloadRequiredDialogProps {
  opened: boolean;
  onReload: () => void;
  recoveryAction?: ReactNode;
}

export function EditorReloadRequiredDialog({ opened, onReload, recoveryAction }: EditorReloadRequiredDialogProps) {
  const t = useTranslations('editorCommon.reloadRequired');

  return (
    <BlockingAlertDialog
      opened={opened}
      onAction={onReload}
      title={t('title')}
      message={
        recoveryAction ? (
          <Stack gap="sm">
            <Text size="sm">{t('message')}</Text>
            {recoveryAction}
          </Stack>
        ) : (
          t('message')
        )
      }
      actionLabel={t('action')}
      level="warning"
      size="compact"
    />
  );
}
