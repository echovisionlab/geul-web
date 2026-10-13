'use client';
import { ConfirmationDialog } from '@/features/confirmation';

import { Text as DsText } from '@/components/core/Typography';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';

import { deletePostAdminAction } from '@/lib/actions/post';
import { usePostModal } from './PostModalContext';

export interface PostModalsProps {
  deleteAction?: typeof deletePostAdminAction;
  onDeleted?: () => void;
}
export function PostModals({ deleteAction = deletePostAdminAction, onDeleted }: PostModalsProps = {}) {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const { deletingPost, closeDelete } = usePostModal();

  // Delete state
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = async () => {
    if (!deletingPost) {
      return;
    }
    setDeleteLoading(true);
    try {
      const result = await deleteAction(deletingPost.id);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemDeleted', { item: tCommon('entities.post') }),
        tone: 'positive',
      });
      closeDelete();
      if (onDeleted) {
        onDeleted();
      } else {
        router.refresh();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <ConfirmationDialog
      intent="delete"
      opened={!!deletingPost}
      onClose={closeDelete}
      onConfirm={handleDelete}
      title={tCommon('actions.delete')}
      message={
        <DsText>
          {tCommon.rich('messages.confirmDeleteNamedRich', {
            name: deletingPost?.title || tCommon('states.untitled'),
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </DsText>
      }
      confirmLabel={tCommon('actions.delete')}
      cancelLabel={tCommon('actions.cancel')}
      closeLabel={tCommon('actions.close')}
      loading={deleteLoading}
    />
  );
}
