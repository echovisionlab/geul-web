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
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from '@/lib/actions/category';
import { useTaxonomyEditDraft } from '@/features/admin/taxonomy-edit-draft';
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
  const [editLoading, setEditLoading] = useState(false);
  const editDraft = useTaxonomyEditDraft(editingCategory, editLoading);

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
    const changes = editDraft.changes();
    if (!editingCategory || !changes) {
      return;
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
        submitTone="brand"
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={editLoading}
        submitDisabled={!editDraft.name.trim()}
      >
        <TextInput
          label={tCommon('labels.name')}
          placeholder={tAdmin('categories.namePlaceholder')}
          value={editDraft.name}
          onChange={(e) => editDraft.setName(e.currentTarget.value)}
          required
        />
        <Textarea
          label={tCommon('labels.description')}
          placeholder={tAdmin('categories.descriptionPlaceholder')}
          value={editDraft.description}
          onChange={(e) => editDraft.setDescription(e.currentTarget.value)}
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
