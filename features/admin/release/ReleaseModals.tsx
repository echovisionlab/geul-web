'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ConfirmModal } from '@/components/core/Modal';
import { deleteReleaseAction } from '@/lib/actions/release';
import { useReleaseModal } from './ReleaseModalContext';

export function ReleaseModals() {
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
      const result = await deleteReleaseAction(deletingRelease.id);
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemDeleted', { item: tCommon('entities.release') }),
        color: 'red',
      });
      closeDelete();
      router.refresh();
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <ConfirmModal
      opened={!!deletingRelease}
      onClose={closeDelete}
      onConfirm={handleDelete}
      title={tCommon('actions.delete')}
      message={
        <Text>
          {tCommon.rich('messages.confirmDeleteNamedRich', {
            name: deletingRelease?.title || tCommon('states.untitled'),
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </Text>
      }
      confirmLabel={tCommon('actions.delete')}
      cancelLabel={tCommon('actions.cancel')}
      closeLabel={tCommon('actions.close')}
      loading={deleteLoading}
    />
  );
}
