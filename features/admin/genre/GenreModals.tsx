'use client';
import { ConfirmationDialog } from '@/features/confirmation';

import { Text as DsText } from '@/components/core/Typography';
import { LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { Textarea, TextInput } from '@/components/core/Input';
import { FormModal } from '@/components/core/Modal';
import { createGenreAction, deleteGenreAction, updateGenreAction } from '@/lib/actions/genre';
import { useGenreModal } from './GenreModalContext';

export interface GenreModalsProps {
  createAction?: typeof createGenreAction;
  deleteAction?: typeof deleteGenreAction;
  updateAction?: typeof updateGenreAction;
  refresh?: () => void;
}
export function GenreModals({
  createAction = createGenreAction,
  deleteAction = deleteGenreAction,
  updateAction = updateGenreAction,
  refresh,
}: GenreModalsProps = {}) {
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
      const result = await createAction(createName, createDescription || undefined);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tAdmin('genres.created'), tone: 'positive' });
      closeCreate();
      (refresh ?? router.refresh)();
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
      const result = await updateAction(editingGenre.id, changes);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tAdmin('genres.updated'), tone: 'positive' });
      closeEdit();
      (refresh ?? router.refresh)();
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
      const result = await deleteAction(deletingGenre.id);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tAdmin('genres.deleted'), tone: 'positive' });
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
      <ConfirmationDialog
        intent="delete"
        opened={!!deletingGenre}
        onClose={closeDelete}
        onConfirm={handleDelete}
        title={tAdmin('genres.deleteTitle')}
        message={
          <>
            <DsText>
              {tCommon.rich('messages.confirmDeleteNamedRich', {
                name: deletingGenre?.name ?? '',
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </DsText>
            {deletingGenre && deletingGenre.releaseCount > 0 && (
              <DsLayoutInset blockStart="xs">
                <DsText size="sm" tone="warning">
                  {tAdmin('genres.deleteWarning', {
                    count: String(deletingGenre.releaseCount),
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
