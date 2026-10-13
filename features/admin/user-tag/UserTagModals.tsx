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
import { createUserTagAction, deleteUserTagAction } from '@/lib/actions/user-tag';
import { useUserTagModal } from './UserTagModalContext';

export interface UserTagModalsProps {
  createAction?: typeof createUserTagAction;
  deleteAction?: typeof deleteUserTagAction;
  refresh?: () => void;
}
export function UserTagModals({
  createAction = createUserTagAction,
  deleteAction = deleteUserTagAction,
  refresh,
}: UserTagModalsProps = {}) {
  const tCommon = useTranslations('common');
  const tPage = useTranslations('adminList.userTags');
  const router = useRouter();
  const { deletingTag, closeDelete, isCreateOpen, closeCreate } = useUserTagModal();

  const [createName, setCreateName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
      notifications.show({ message: tCommon('notifications.tagCreated'), tone: 'positive' });
      closeCreate();
      (refresh ?? router.refresh)();
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTag) {
      return;
    }
    setDeleteLoading(true);
    try {
      const result = await deleteAction(deletingTag.id);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tCommon('notifications.tagDeleted'), tone: 'positive' });
      closeDelete();
      (refresh ?? router.refresh)();
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <FormModal
        opened={isCreateOpen}
        onClose={closeCreate}
        onSubmit={handleCreate}
        title={tPage('createTitle')}
        submitLabel={tCommon('actions.createItem', { item: tCommon('entities.userTag') })}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={createLoading}
        submitDisabled={!createName.trim()}
      >
        <TextInput
          label={tCommon('labels.name')}
          placeholder={tPage('namePlaceholder')}
          value={createName}
          onChange={(e) => setCreateName(e.currentTarget.value)}
          required
        />
      </FormModal>

      <ConfirmationDialog
        intent="delete"
        opened={!!deletingTag}
        onClose={closeDelete}
        onConfirm={handleDelete}
        title={tPage('deleteTitle')}
        message={
          <>
            <DsText>{tPage('deleteConfirm', { name: deletingTag?.name ?? '' })}</DsText>
            {deletingTag && deletingTag.user_count > 0 && (
              <DsLayoutInset blockStart="xs">
                <DsText size="sm" tone="warning">
                  {tPage('deleteAssignedWarning', { count: deletingTag.user_count })}
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
