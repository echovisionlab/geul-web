'use client';
import { ConfirmationDialog } from '@/features/confirmation';

import { Text as DsText } from '@/components/core/Typography';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';

import { deleteClientAction } from '@/lib/actions/client';
import { useClientModal } from './ClientModalContext';

export interface ClientModalsProps {
  deleteAction?: typeof deleteClientAction;
  onDeleted?: () => void;
}
export function ClientModals({ deleteAction = deleteClientAction, onDeleted }: ClientModalsProps = {}) {
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
      const result = await deleteAction(deletingClient.id);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tPage('deleted'), tone: 'positive' });
      closeDelete();
      if (onDeleted) {
        onDeleted();
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
      opened={!!deletingClient}
      onClose={closeDelete}
      onConfirm={handleDelete}
      title={tPage('deleteTitle')}
      message={<DsText>{tPage('deleteConfirm', { name: deletingClient?.name ?? '' })}</DsText>}
      confirmLabel={tCommon('actions.delete')}
      cancelLabel={tCommon('actions.cancel')}
      closeLabel={tCommon('actions.close')}
      loading={deleteLoading}
    />
  );
}
