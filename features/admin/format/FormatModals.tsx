'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { TextInput } from '@/components/core/Input';
import { ConfirmModal, FormModal } from '@/components/core/Modal';
import { createFormatAction, deleteFormatAction, updateFormatAction } from '@/lib/actions/format';
import { useFormatModal } from './FormatModalContext';

export function FormatModals() {
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
      const result = await createFormatAction(createName);
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tAdmin('formats.created'), color: 'green' });
      closeCreate();
      router.refresh();
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
      const result = await updateFormatAction(editingFormat.id, { name: editName });
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tAdmin('formats.updated'), color: 'green' });
      closeEdit();
      router.refresh();
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
      const result = await deleteFormatAction(deletingFormat.id);
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tAdmin('formats.deleted'), color: 'red' });
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
      <ConfirmModal
        opened={!!deletingFormat}
        onClose={closeDelete}
        onConfirm={handleDelete}
        title={tAdmin('formats.deleteTitle')}
        message={
          <>
            <Text>
              {tCommon.rich('messages.confirmDeleteNamedRich', {
                name: deletingFormat?.name ?? '',
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </Text>
            {deletingFormat && deletingFormat.releaseCount > 0 && (
              <Text size="sm" c="orange" mt="xs">
                {tAdmin('formats.deleteWarning', {
                  count: String(deletingFormat.releaseCount),
                })}
              </Text>
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
