'use client';
import { ConfirmationDialog } from '@/features/confirmation';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';

import { deleteFormAction } from '@/lib/actions/form';
import { useFormModal } from './FormModalContext';

export function FormModals({
  deleteAction = deleteFormAction,
  refresh,
}: { deleteAction?: typeof deleteFormAction; refresh?: () => void } = {}) {
  const router = useRouter();
  const t = useTranslations('formAdmin');
  const tCommon = useTranslations('common');
  const { deletingForm, closeDelete } = useFormModal();

  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = async () => {
    if (!deletingForm) {
      return;
    }
    setDeleteLoading(true);
    try {
      const result = await deleteAction(deletingForm.id);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: t('notifications.deleted'), tone: 'positive' });
      closeDelete();
      (refresh ?? router.refresh)();
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <ConfirmationDialog
      intent="delete"
      opened={!!deletingForm}
      onClose={closeDelete}
      onConfirm={handleDelete}
      title={tCommon('actions.delete')}
      message={
        <DsLayoutStack gap="xs">
          <DsText>
            {tCommon.rich('messages.confirmDeleteNamedRich', {
              name: deletingForm?.title || tCommon('entities.form'),
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </DsText>
          <DsText size="sm" tone="warning">
            {t('deleteModal.warning')}
          </DsText>
        </DsLayoutStack>
      }
      confirmLabel={tCommon('actions.delete')}
      cancelLabel={tCommon('actions.cancel')}
      closeLabel={tCommon('actions.close')}
      loading={deleteLoading}
    />
  );
}
