'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ConfirmModal } from '@/components/core/Modal';
import { deleteFormAction } from '@/lib/actions/form';
import { useFormModal } from './FormModalContext';

export function FormModals() {
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
      const result = await deleteFormAction(deletingForm.id);
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: t('notifications.deleted'), color: 'red' });
      closeDelete();
      router.refresh();
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <ConfirmModal
      opened={!!deletingForm}
      onClose={closeDelete}
      onConfirm={handleDelete}
      title={tCommon('actions.delete')}
      message={
        <Stack gap="xs">
          <Text>
            {tCommon.rich('messages.confirmDeleteNamedRich', {
              name: deletingForm?.title || tCommon('entities.form'),
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </Text>
          <Text size="sm" c="orange">
            {t('deleteModal.warning')}
          </Text>
        </Stack>
      }
      confirmLabel={tCommon('actions.delete')}
      cancelLabel={tCommon('actions.cancel')}
      closeLabel={tCommon('actions.close')}
      loading={deleteLoading}
    />
  );
}
