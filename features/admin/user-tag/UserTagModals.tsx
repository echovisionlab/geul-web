'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { TextInput } from '@/components/core/Input';
import { ConfirmModal, FormModal } from '@/components/core/Modal';
import { createUserTagAction, deleteUserTagAction } from '@/lib/actions/user-tag';
import { useUserTagModal } from './UserTagModalContext';

export function UserTagModals() {
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
      const result = await createUserTagAction(createName);
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

  const handleDelete = async () => {
    if (!deletingTag) {
      return;
    }
    setDeleteLoading(true);
    try {
      const result = await deleteUserTagAction(deletingTag.id);
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

      <ConfirmModal
        opened={!!deletingTag}
        onClose={closeDelete}
        onConfirm={handleDelete}
        title={tPage('deleteTitle')}
        message={
          <>
            <Text>{tPage('deleteConfirm', { name: deletingTag?.name ?? '' })}</Text>
            {deletingTag && deletingTag.user_count > 0 && (
              <Text size="sm" c="orange" mt="xs">
                {tPage('deleteAssignedWarning', { count: deletingTag.user_count })}
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
