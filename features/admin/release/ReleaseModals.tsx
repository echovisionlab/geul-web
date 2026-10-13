'use client';
import { ConfirmationDialog } from '@/features/confirmation';

import { Text as DsText } from '@/components/core/Typography';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';

import { deleteReleaseAction } from '@/lib/actions/release';
import { useReleaseModal } from './ReleaseModalContext';

interface ReleaseModalsProps {
  deleteAction?: typeof deleteReleaseAction;
  onDeleted?: (id: string) => void;
}
export function ReleaseModals({ deleteAction = deleteReleaseAction, onDeleted }: ReleaseModalsProps = {}) {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const { deletingRelease, closeDelete } = useReleaseModal();

  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = async () => {
    if (!deletingRelease) {
      return;
    }
    setDeleteLoading(true);
    try {
      const result = await deleteAction(deletingRelease.id);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemDeleted', { item: tCommon('entities.release') }),
        tone: 'positive',
      });
      closeDelete();
      if (onDeleted) {
        onDeleted(deletingRelease.id);
      } else {
        router.refresh();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <ConfirmationDialog
      intent="delete"
      opened={!!deletingRelease}
      onClose={closeDelete}
      onConfirm={handleDelete}
      title={tCommon('actions.delete')}
      message={
        <DsText>
          {tCommon.rich('messages.confirmDeleteNamedRich', {
            name: deletingRelease?.title || tCommon('states.untitled'),
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </DsText>
      }
      confirmLabel={tCommon('actions.delete')}
      cancelLabel={tCommon('actions.cancel')}
      closeLabel={tCommon('actions.close')}
      loading={deleteLoading}
    />
  );
}
