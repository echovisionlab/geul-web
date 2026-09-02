'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ConfirmModal } from '@/components/core/Modal';
import { deleteClientAction } from '@/lib/actions/client';
import { useClientModal } from './ClientModalContext';

export function ClientModals() {
  const tCommon = useTranslations('common');
  const tPage = useTranslations('adminList.clients');
  const router = useRouter();
  const { deletingClient, closeDelete } = useClientModal();

  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = async () => {
    if (!deletingClient) {
      return;
    }
    setDeleteLoading(true);
    try {
      const result = await deleteClientAction(deletingClient.id);
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tPage('deleted'), color: 'red' });
      closeDelete();
      router.refresh();
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <ConfirmModal
      opened={!!deletingClient}
      onClose={closeDelete}
      onConfirm={handleDelete}
      title={tPage('deleteTitle')}
      message={<Text>{tPage('deleteConfirm', { name: deletingClient?.name ?? '' })}</Text>}
      confirmLabel={tCommon('actions.delete')}
      cancelLabel={tCommon('actions.cancel')}
      closeLabel={tCommon('actions.close')}
      loading={deleteLoading}
    />
  );
}
