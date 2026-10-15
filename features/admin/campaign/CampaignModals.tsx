'use client';
import { ConfirmationDialog } from '@/features/confirmation';

import { Text as DsText } from '@/components/core/Typography';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';

import { deleteCampaignAction } from '@/lib/actions/campaign';
import { useCampaignModal } from './CampaignModalContext';

export function CampaignModals({
  deleteAction = deleteCampaignAction,
  refresh,
}: { deleteAction?: typeof deleteCampaignAction; refresh?: () => void } = {}) {
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
      const result = await deleteAction(deletingCampaign.id);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tPage('deleted'), tone: 'positive' });
      closeDelete();
      (refresh ?? router.refresh)();
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <ConfirmationDialog
      intent="delete"
      opened={!!deletingCampaign}
      onClose={closeDelete}
      onConfirm={handleDelete}
      title={tPage('deleteTitle')}
      message={<DsText>{tPage('deleteConfirm')}</DsText>}
      confirmLabel={tCommon('actions.delete')}
      cancelLabel={tCommon('actions.cancel')}
      closeLabel={tCommon('actions.close')}
      loading={deleteLoading}
    />
  );
}
