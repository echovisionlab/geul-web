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
import { createStyleAction, deleteStyleAction, updateStyleAction } from '@/lib/actions/style';
import { useStyleModal } from './StyleModalContext';

export interface StyleModalsProps {
  createAction?: typeof createStyleAction;
  deleteAction?: typeof deleteStyleAction;
  updateAction?: typeof updateStyleAction;
  refresh?: () => void;
}
export function StyleModals({
  createAction = createStyleAction,
  deleteAction = deleteStyleAction,
  updateAction = updateStyleAction,
  refresh,
}: StyleModalsProps = {}) {
  const tCommon = useTranslations('common');
  const tAdmin = useTranslations('adminList');
  const router = useRouter();
  const { editingStyle, closeEdit, deletingStyle, closeDelete, isCreateOpen, closeCreate } = useStyleModal();

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

  // Sync edit form with editing style
  useEffect(() => {
    if (!editingStyle) {
      editBaselineRef.current = null;
      return;
    }

    const nextBaseline = {
      id: editingStyle.id,
      name: editingStyle.name,
      description: editingStyle.description || '',
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
  }, [editingStyle, editDescription, editLoading, editName]);

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
      notifications.show({ message: tAdmin('styles.created'), tone: 'positive' });
      closeCreate();
      (refresh ?? router.refresh)();
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editingStyle) {
      return;
    }
    const baseline = editBaselineRef.current;
    if (!baseline || baseline.id !== editingStyle.id) {
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
      const result = await updateAction(editingStyle.id, changes);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tAdmin('styles.updated'), tone: 'positive' });
      closeEdit();
      (refresh ?? router.refresh)();
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingStyle) {
      return;
    }
    setDeleteLoading(true);
    try {
      const result = await deleteAction(deletingStyle.id);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tAdmin('styles.deleted'), tone: 'positive' });
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
        title={tAdmin('styles.createTitle')}
        submitLabel={tCommon('actions.create')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={createLoading}
        submitDisabled={!createName.trim()}
      >
        <TextInput
          label={tCommon('labels.name')}
          placeholder={tAdmin('styles.namePlaceholder')}
          value={createName}
          onChange={(e) => setCreateName(e.currentTarget.value)}
          required
        />
        <Textarea
          label={tCommon('labels.description')}
          placeholder={tAdmin('styles.descriptionPlaceholder')}
          value={createDescription}
          onChange={(e) => setCreateDescription(e.currentTarget.value)}
          rows={3}
        />
      </FormModal>

      {/* Edit Modal */}
      <FormModal
        opened={!!editingStyle}
        onClose={closeEdit}
        onSubmit={handleEdit}
        title={tAdmin('styles.editTitle')}
        submitLabel={tCommon('actions.save')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={editLoading}
        submitDisabled={!editName.trim()}
      >
        <TextInput
          label={tCommon('labels.name')}
          placeholder={tAdmin('styles.namePlaceholder')}
          value={editName}
          onChange={(e) => setEditName(e.currentTarget.value)}
          required
        />
        <Textarea
          label={tCommon('labels.description')}
          placeholder={tAdmin('styles.descriptionPlaceholder')}
          value={editDescription}
          onChange={(e) => setEditDescription(e.currentTarget.value)}
          rows={3}
        />
      </FormModal>

      {/* Delete Modal */}
      <ConfirmationDialog
        intent="delete"
        opened={!!deletingStyle}
        onClose={closeDelete}
        onConfirm={handleDelete}
        title={tAdmin('styles.deleteTitle')}
        message={
          <>
            <DsText>
              {tCommon.rich('messages.confirmDeleteNamedRich', {
                name: deletingStyle?.name ?? '',
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </DsText>
            {deletingStyle && deletingStyle.releaseCount > 0 && (
              <DsLayoutInset blockStart="xs">
                <DsText size="sm" tone="warning">
                  {tAdmin('styles.deleteWarning', {
                    count: String(deletingStyle.releaseCount),
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
