'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Textarea, TextInput } from '@/components/core/Input';
import { ConfirmModal, FormModal } from '@/components/core/Modal';
import { createGenreAction, deleteGenreAction, updateGenreAction } from '@/lib/actions/genre';
import { useGenreModal } from './GenreModalContext';

export function GenreModals() {
  const tCommon = useTranslations('common');
  const tAdmin = useTranslations('adminList');
  const router = useRouter();
  const { editingGenre, closeEdit, deletingGenre, closeDelete, isCreateOpen, closeCreate } = useGenreModal();

  // Create form state
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const editBaselineRef = useRef<{ id: string; name: string; description: string } | null>(null);

  // Delete state
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Sync edit form with editing genre
  useEffect(() => {
    if (!editingGenre) {
      editBaselineRef.current = null;
      return;
    }

    const nextBaseline = {
      id: editingGenre.id,
      name: editingGenre.name,
      description: editingGenre.description || '',
    };
    const baseline = editBaselineRef.current;
    if (!baseline || baseline.id !== nextBaseline.id) {
      editBaselineRef.current = nextBaseline;
      setEditName(nextBaseline.name);
      setEditDescription(nextBaseline.description);
      return;
    }
    if (editLoading || editName !== baseline.name || editDescription !== baseline.description) {
      return;
    }

    editBaselineRef.current = nextBaseline;
    setEditName(nextBaseline.name);
    setEditDescription(nextBaseline.description);
  }, [editingGenre, editDescription, editLoading, editName]);

  // Reset create form when closed
  useEffect(() => {
    if (!isCreateOpen) {
      setCreateName('');
      setCreateDescription('');
    }
  }, [isCreateOpen]);

  const handleCreate = async () => {
    setCreateLoading(true);
    try {
      const result = await createGenreAction(createName, createDescription || undefined);
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tAdmin('genres.created'), color: 'green' });
      closeCreate();
      router.refresh();
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editingGenre) {
      return;
    }
    const baseline = editBaselineRef.current;
    if (!baseline || baseline.id !== editingGenre.id) {
      return;
    }
    const changes: { name?: string; description?: string | null } = {};
    if (editName !== baseline.name) {
      changes.name = editName;
    }
    if (editDescription !== baseline.description) {
      changes.description = editDescription || null;
    }
    if (Object.keys(changes).length === 0) {
      closeEdit();
      return;
    }

    setEditLoading(true);
    try {
      const result = await updateGenreAction(editingGenre.id, changes);
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tAdmin('genres.updated'), color: 'green' });
      closeEdit();
      router.refresh();
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingGenre) {
      return;
    }
    setDeleteLoading(true);
    try {
      const result = await deleteGenreAction(deletingGenre.id);
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tAdmin('genres.deleted'), color: 'red' });
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
        title={tAdmin('genres.createTitle')}
        submitLabel={tCommon('actions.create')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={createLoading}
        submitDisabled={!createName.trim()}
      >
        <TextInput
          label={tCommon('labels.name')}
          placeholder={tAdmin('genres.namePlaceholder')}
          value={createName}
          onChange={(e) => setCreateName(e.currentTarget.value)}
          required
        />
        <Textarea
          label={tCommon('labels.description')}
          placeholder={tAdmin('genres.descriptionPlaceholder')}
          value={createDescription}
          onChange={(e) => setCreateDescription(e.currentTarget.value)}
          rows={3}
        />
      </FormModal>

      {/* Edit Modal */}
      <FormModal
        opened={!!editingGenre}
        onClose={closeEdit}
        onSubmit={handleEdit}
        title={tAdmin('genres.editTitle')}
        submitLabel={tCommon('actions.save')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={editLoading}
        submitDisabled={!editName.trim()}
      >
        <TextInput
          label={tCommon('labels.name')}
          placeholder={tAdmin('genres.namePlaceholder')}
          value={editName}
          onChange={(e) => setEditName(e.currentTarget.value)}
          required
        />
        <Textarea
          label={tCommon('labels.description')}
          placeholder={tAdmin('genres.descriptionPlaceholder')}
          value={editDescription}
          onChange={(e) => setEditDescription(e.currentTarget.value)}
          rows={3}
        />
      </FormModal>

      {/* Delete Modal */}
      <ConfirmModal
        opened={!!deletingGenre}
        onClose={closeDelete}
        onConfirm={handleDelete}
        title={tAdmin('genres.deleteTitle')}
        message={
          <>
            <Text>
              {tCommon.rich('messages.confirmDeleteNamedRich', {
                name: deletingGenre?.name ?? '',
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </Text>
            {deletingGenre && deletingGenre.releaseCount > 0 && (
              <Text size="sm" c="orange" mt="xs">
                {tAdmin('genres.deleteWarning', {
                  count: String(deletingGenre.releaseCount),
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
