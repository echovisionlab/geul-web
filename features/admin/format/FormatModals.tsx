'use client';
import { ConfirmationDialog } from '@/features/confirmation';

import { Text as DsText } from '@/components/core/Typography';
import { LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { TextInput } from '@/components/core/Input';
import { FormModal } from '@/components/core/Modal';
import { createFormatAction, deleteFormatAction, updateFormatAction } from '@/lib/actions/format';
import { useFormatModal } from './FormatModalContext';

export interface FormatModalsProps {
  createAction?: typeof createFormatAction;
  deleteAction?: typeof deleteFormatAction;
  updateAction?: typeof updateFormatAction;
  refresh?: () => void;
}
export function FormatModals({
  createAction = createFormatAction,
  deleteAction = deleteFormatAction,
  updateAction = updateFormatAction,
  refresh,
}: FormatModalsProps = {}) {
  const tCommon = useTranslations('common');
  const tAdmin = useTranslations('adminList');
  const router = useRouter();
  const { editingFormat, closeEdit, deletingFormat, closeDelete, isCreateOpen, closeCreate } = useFormatModal();

  // Create form state
  const [createName, setCreateName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Delete state
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Sync edit form with editing format
  useEffect(() => {
    if (editingFormat) {
      setEditName(editingFormat.name);
    }
  }, [editingFormat]);

  // Reset create form when closed
  useEffect(() => {
    if (!isCreateOpen) {
      setCreateName('');
    }
  }, [isCreateOpen]);

  const handleCreate = async () => {
    setCreateLoading(true);
    try {
      const result = await createAction(createName);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tAdmin('formats.created'), tone: 'positive' });
      closeCreate();
      (refresh ?? router.refresh)();
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editingFormat) {
      return;
    }
    setEditLoading(true);
    try {
      const result = await updateAction(editingFormat.id, { name: editName });
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tAdmin('formats.updated'), tone: 'positive' });
      closeEdit();
      (refresh ?? router.refresh)();
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingFormat) {
      return;
    }
    setDeleteLoading(true);
    try {
      const result = await deleteAction(deletingFormat.id);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tAdmin('formats.deleted'), tone: 'positive' });
      closeDelete();
      (refresh ?? router.refresh)();
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
        title={tAdmin('formats.createTitle')}
        submitLabel={tCommon('actions.create')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={createLoading}
        submitDisabled={!createName.trim()}
      >
        <TextInput
          label={tCommon('labels.name')}
          placeholder={tAdmin('formats.namePlaceholder')}
          value={createName}
          onChange={(e) => setCreateName(e.currentTarget.value)}
          required
        />
      </FormModal>

      {/* Edit Modal */}
      <FormModal
        opened={!!editingFormat}
        onClose={closeEdit}
        onSubmit={handleEdit}
        title={tAdmin('formats.editTitle')}
        submitLabel={tCommon('actions.save')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={editLoading}
        submitDisabled={!editName.trim()}
      >
        <TextInput
          label={tCommon('labels.name')}
          placeholder={tAdmin('formats.editNamePlaceholder')}
          value={editName}
          onChange={(e) => setEditName(e.currentTarget.value)}
          required
        />
      </FormModal>

      {/* Delete Modal */}
      <ConfirmationDialog
        intent="delete"
        opened={!!deletingFormat}
        onClose={closeDelete}
        onConfirm={handleDelete}
        title={tAdmin('formats.deleteTitle')}
        message={
          <>
            <DsText>
              {tCommon.rich('messages.confirmDeleteNamedRich', {
                name: deletingFormat?.name ?? '',
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </DsText>
            {deletingFormat && deletingFormat.releaseCount > 0 && (
              <DsLayoutInset blockStart="xs">
                <DsText size="sm" tone="warning">
                  {tAdmin('formats.deleteWarning', {
                    count: String(deletingFormat.releaseCount),
                  })}
                </DsText>
              </DsLayoutInset>
            )}
          </>
        }
        confirmLabel={tCommon('actions.delete')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={deleteLoading}
      />
    </>
  );
}
