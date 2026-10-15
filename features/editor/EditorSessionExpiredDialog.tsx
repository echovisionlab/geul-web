'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BlockingAlertDialog } from '@/components/core/Modal';
import { leaveOrResume, prepareToLeaveWithDurableEdits } from '@/lib/editor/leave-with-durable-edits';

export interface EditorSessionExpiredDialogProps {
  opened: boolean;
  /** Leaves for sign-in; called once every unsaved edit has been written to this device. */
  onConfirm: () => void;
}

export function EditorSessionExpiredDialog({ opened, onConfirm }: EditorSessionExpiredDialogProps) {
  const t = useTranslations('editorCommon.sessionExpired');
  const tActions = useTranslations('common.actions');
  const [leaving, setLeaving] = useState(false);

  return (
    <BlockingAlertDialog
      opened={opened}
      onAction={() => {
        setLeaving(true);
        // Unsaved edits stay on this device and return after the same member signs in again.
        void prepareToLeaveWithDurableEdits().finally(() => leaveOrResume(onConfirm, () => setLeaving(false)));
      }}
      loading={leaving}
      title={t('title')}
      message={t('message')}
      actionLabel={tActions('logIn')}
      level="warning"
      size="compact"
    />
  );
}
