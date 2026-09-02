'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ConfirmModal } from '@/components/core/Modal';
import { deleteCampaignAction } from '@/lib/actions/campaign';
import { useCampaignModal } from './CampaignModalContext';

export function CampaignModals() {
  const tCommon = useTranslations('common');
  const tPage = useTranslations('adminList.campaigns');
  const router = useRouter();
  const { deletingCampaign, closeDelete } = useCampaignModal();

  // Delete state
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = async () => {
    if (!deletingCampaign) {
      return;
    }
    setDeleteLoading(true);
    try {
      const result = await deleteCampaignAction(deletingCampaign.id);
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
      opened={!!deletingCampaign}
      onClose={closeDelete}
      onConfirm={handleDelete}
      title={tPage('deleteTitle')}
      message={<Text>{tPage('deleteConfirm')}</Text>}
      confirmLabel={tCommon('actions.delete')}
      cancelLabel={tCommon('actions.cancel')}
      closeLabel={tCommon('actions.close')}
      loading={deleteLoading}
    />
  );
}
