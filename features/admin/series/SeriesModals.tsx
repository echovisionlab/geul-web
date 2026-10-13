'use client';
import { ConfirmationDialog } from '@/features/confirmation';

import { Text as DsText } from '@/components/core/Typography';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { TextInput } from '@/components/core/Input';
import { FormModal } from '@/components/core/Modal';
import { createSeriesAction, deleteSeriesAction } from '@/lib/actions/series';
import { useSeriesModal } from './SeriesModalContext';

export interface SeriesModalsProps {
  createAction?: typeof createSeriesAction;
  deleteAction?: typeof deleteSeriesAction;
  onCreated?: (id: string) => void;
  onDeleted?: () => void;
}
export function SeriesModals({
  createAction = createSeriesAction,
  deleteAction = deleteSeriesAction,
  onCreated,
  onDeleted,
}: SeriesModalsProps = {}) {
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
      const result = await createAction({
        title: createTitle,
        description: createDescription || undefined,
      });
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tCommonNotifications('seriesCreated'), tone: 'positive' });
      if (result.data) {
        if (onCreated) {
          closeCreate();
          onCreated(result.data.id);
          return;
        }
        const href = `/admin/series/${result.data.id}`;
        startNavigation(() => {
          router.push(href);
        });
      } else {
        closeCreate();
        if (onDeleted) {
          onDeleted();
        } else {
          router.refresh();
        }
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
      const result = await deleteAction(deletingSeries.id);
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
      <ConfirmationDialog
        intent="delete"
        opened={!!deletingSeries}
        onClose={closeDelete}
        onConfirm={handleDelete}
        title={tPage('deleteTitle')}
        message={<DsText>{tPage('deleteConfirm')}</DsText>}
        confirmLabel={tCommon('actions.delete')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={deleteLoading}
      />
    </>
  );
}
