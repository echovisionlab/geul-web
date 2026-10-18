'use client';
import { ConfirmationDialog } from '@/features/confirmation';

import { Text as DsText } from '@/components/core/Typography';
import { LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { Textarea, TextInput } from '@/components/core/Input';
import { FormModal } from '@/components/core/Modal';
import { createStyleAction, deleteStyleAction, updateStyleAction } from '@/lib/actions/style';
import { useTaxonomyEditDraft } from '@/features/admin/taxonomy-edit-draft';
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
  const [editLoading, setEditLoading] = useState(false);
  const editDraft = useTaxonomyEditDraft(editingStyle, editLoading);

  // Delete state
  const [deleteLoading, setDeleteLoading] = useState(false);

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
    const changes = editDraft.changes();
    if (!editingStyle || !changes) {
      return;
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
        submitDisabled={!editDraft.name.trim()}
      >
        <TextInput
          label={tCommon('labels.name')}
          placeholder={tAdmin('styles.namePlaceholder')}
          value={editDraft.name}
          onChange={(e) => editDraft.setName(e.currentTarget.value)}
          required
        />
        <Textarea
          label={tCommon('labels.description')}
          placeholder={tAdmin('styles.descriptionPlaceholder')}
          value={editDraft.description}
          onChange={(e) => editDraft.setDescription(e.currentTarget.value)}
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
