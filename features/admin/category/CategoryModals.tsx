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
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from '@/lib/actions/category';
import { useCategoryModal } from './CategoryModalContext';

export interface CategoryModalsProps {
  createAction?: typeof createCategoryAction;
  deleteAction?: typeof deleteCategoryAction;
  updateAction?: typeof updateCategoryAction;
  refresh?: () => void;
}
export function CategoryModals({
  createAction = createCategoryAction,
  deleteAction = deleteCategoryAction,
  updateAction = updateCategoryAction,
  refresh,
}: CategoryModalsProps = {}) {
  const tCommon = useTranslations('common');
  const tAdmin = useTranslations('adminList');
  const router = useRouter();
  const { editingCategory, closeEdit, deletingCategory, closeDelete, isCreateOpen, closeCreate } = useCategoryModal();

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

  // Sync edit form with editing category
  useEffect(() => {
    if (!editingCategory) {
      editBaselineRef.current = null;
      return;
    }

    const nextBaseline = {
      id: editingCategory.id,
      name: editingCategory.name,
      description: editingCategory.description || '',
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
  }, [editingCategory, editDescription, editLoading, editName]);

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
      const result = await createAction({
        name: createName,
        description: createDescription || undefined,
      });
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tCommon('notifications.categoryCreated'), tone: 'positive' });
      closeCreate();
      (refresh ?? router.refresh)();
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editingCategory) {
      return;
    }
    const baseline = editBaselineRef.current;
    if (!baseline || baseline.id !== editingCategory.id) {
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
      const result = await updateAction(editingCategory.id, changes);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tAdmin('categories.updated'), tone: 'positive' });
      closeEdit();
      (refresh ?? router.refresh)();
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCategory) {
      return;
    }
    setDeleteLoading(true);
    try {
      const result = await deleteAction(deletingCategory.id);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tAdmin('categories.deleted'), tone: 'positive' });
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
        title={tAdmin('categories.createTitle')}
        submitLabel={tCommon('actions.create')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={createLoading}
        submitDisabled={!createName.trim()}
      >
        <TextInput
          label={tCommon('labels.name')}
          placeholder={tAdmin('categories.namePlaceholder')}
          value={createName}
          onChange={(e) => setCreateName(e.currentTarget.value)}
          required
        />
        <Textarea
          label={tCommon('labels.description')}
          placeholder={tAdmin('categories.descriptionPlaceholder')}
          value={createDescription}
          onChange={(e) => setCreateDescription(e.currentTarget.value)}
          rows={3}
        />
      </FormModal>

      {/* Edit Modal */}
      <FormModal
        opened={!!editingCategory}
        onClose={closeEdit}
        onSubmit={handleEdit}
        title={tAdmin('categories.editTitle')}
        submitLabel={tCommon('actions.save')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={editLoading}
        submitDisabled={!editName.trim()}
      >
        <TextInput
          label={tCommon('labels.name')}
          placeholder={tAdmin('categories.namePlaceholder')}
          value={editName}
          onChange={(e) => setEditName(e.currentTarget.value)}
          required
        />
        <Textarea
          label={tCommon('labels.description')}
          placeholder={tAdmin('categories.descriptionPlaceholder')}
          value={editDescription}
          onChange={(e) => setEditDescription(e.currentTarget.value)}
          rows={3}
        />
      </FormModal>

      {/* Delete Modal */}
      <ConfirmationDialog
        intent="delete"
        opened={!!deletingCategory}
        onClose={closeDelete}
        onConfirm={handleDelete}
        title={tAdmin('categories.deleteTitle')}
        message={
          <>
            <DsText>
              {tCommon.rich('messages.confirmDeleteNamedRich', {
                name: deletingCategory?.name ?? '',
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </DsText>
            {deletingCategory && deletingCategory.postCount > 0 && (
              <DsLayoutInset blockStart="xs">
                <DsText size="sm" tone="warning">
                  {tAdmin('categories.deleteWarning', {
                    count: String(deletingCategory.postCount),
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
