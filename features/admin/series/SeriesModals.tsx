'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { TextInput } from '@/components/core/Input';
import { ConfirmModal, FormModal } from '@/components/core/Modal';
import { createSeriesAction, deleteSeriesAction } from '@/lib/actions/series';
import { useSeriesModal } from './SeriesModalContext';

export function SeriesModals() {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonNotifications = useTranslations('common.notifications');
  const tPage = useTranslations('adminList.series');
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const { deletingSeries, closeDelete, isCreateOpen, closeCreate } = useSeriesModal();

  // Create form state
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Delete state
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Reset create form when closed
  useEffect(() => {
    if (!isCreateOpen) {
      setCreateTitle('');
      setCreateDescription('');
    }
  }, [isCreateOpen]);

  const handleCreate = async () => {
    setCreateLoading(true);
    try {
      const result = await createSeriesAction({
        title: createTitle,
        description: createDescription || undefined,
      });
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tCommonNotifications('seriesCreated'), color: 'green' });
      if (result.data) {
        const href = `/admin/series/${result.data.id}`;
        startNavigation(() => {
          router.push(href);
        });
      } else {
        closeCreate();
        router.refresh();
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSeries) {
      return;
    }
    setDeleteLoading(true);
    try {
      const result = await deleteSeriesAction(deletingSeries.id);
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
    <>
      {/* Create Modal */}
      <FormModal
        opened={isCreateOpen}
        onClose={closeCreate}
        onSubmit={handleCreate}
        title={tPage('createTitle')}
        submitLabel={tCommon('actions.createItem', { item: tCommonEntities('series') })}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={createLoading || isNavigating}
        submitDisabled={!createTitle.trim()}
      >
        <TextInput
          label={tCommon('labels.title')}
          placeholder={tPage('titlePlaceholder')}
          value={createTitle}
          onChange={(e) => setCreateTitle(e.currentTarget.value)}
          required
        />
        <TextInput
          label={tCommon('labels.description')}
          placeholder={tCommon('placeholders.optionalDescription')}
          value={createDescription}
          onChange={(e) => setCreateDescription(e.currentTarget.value)}
        />
      </FormModal>

      {/* Delete Modal */}
      <ConfirmModal
        opened={!!deletingSeries}
        onClose={closeDelete}
        onConfirm={handleDelete}
        title={tPage('deleteTitle')}
        message={<Text>{tPage('deleteConfirm')}</Text>}
        confirmLabel={tCommon('actions.delete')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={deleteLoading}
      />
    </>
  );
}
