'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { TextInput } from '@/components/core/Input';
import { ConfirmModal, FormModal } from '@/components/core/Modal';
import { createTagAction, deleteTagAction, updateTagAction } from '@/lib/actions/tag';
import { useTagModal } from './TagModalContext';

export function TagModals() {
  const tCommon = useTranslations('common');
  const tAdmin = useTranslations('adminList');
  const router = useRouter();
  const { editingTag, closeEdit, deletingTag, closeDelete, isCreateOpen, closeCreate } = useTagModal();

  // Create form state
  const [createName, setCreateName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Delete state
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Sync edit form with editing tag
  useEffect(() => {
    if (editingTag) {
      setEditName(editingTag.name);
    }
  }, [editingTag]);

  // Reset create form when closed
  useEffect(() => {
    if (!isCreateOpen) {
      setCreateName('');
    }
  }, [isCreateOpen]);

  const handleCreate = async () => {
    setCreateLoading(true);
    try {
      const result = await createTagAction(createName);
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tCommon('notifications.tagCreated'), color: 'green' });
      closeCreate();
      router.refresh();
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editingTag) {
      return;
    }
    setEditLoading(true);
    try {
      const result = await updateTagAction(editingTag.id, editName);
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tAdmin('tags.updated'), color: 'green' });
      closeEdit();
      router.refresh();
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTag) {
      return;
    }
    setDeleteLoading(true);
    try {
      const result = await deleteTagAction(deletingTag.id);
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tCommon('notifications.tagDeleted'), color: 'red' });
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
        title={tAdmin('tags.createTitle')}
        submitLabel={tCommon('actions.create')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={createLoading}
        submitDisabled={!createName.trim()}
      >
        <TextInput
          label={tCommon('labels.name')}
          placeholder={tAdmin('tags.namePlaceholder')}
          value={createName}
          onChange={(e) => setCreateName(e.currentTarget.value)}
          required
        />
      </FormModal>

      {/* Edit Modal */}
      <FormModal
        opened={!!editingTag}
        onClose={closeEdit}
        onSubmit={handleEdit}
        title={tAdmin('tags.editTitle')}
        submitLabel={tCommon('actions.save')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={editLoading}
        submitDisabled={!editName.trim()}
      >
        <TextInput
          label={tCommon('labels.name')}
          placeholder={tAdmin('tags.namePlaceholder')}
          value={editName}
          onChange={(e) => setEditName(e.currentTarget.value)}
          required
        />
      </FormModal>

      {/* Delete Modal */}
      <ConfirmModal
        opened={!!deletingTag}
        onClose={closeDelete}
        onConfirm={handleDelete}
        title={tAdmin('tags.deleteTitle')}
        message={
          <>
            <Text>
              {tCommon.rich('messages.confirmDeleteNamedRich', {
                name: deletingTag?.name ?? '',
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </Text>
            {deletingTag && deletingTag.postCount > 0 && (
              <Text size="sm" c="orange" mt="xs">
                {tAdmin('tags.deleteWarning', {
                  count: String(deletingTag.postCount),
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
