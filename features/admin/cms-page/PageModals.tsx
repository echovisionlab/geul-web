'use client';
import { ConfirmationDialog } from '@/features/confirmation';

import { Text as DsText } from '@/components/core/Typography';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';

import { deletePageAdminAction } from '@/lib/actions/page';
import { usePageModal } from './PageModalContext';

interface PageModalsProps {
  deleteAction?: typeof deletePageAdminAction;
  refresh?: () => void;
}

export function PageModals({ deleteAction = deletePageAdminAction, refresh }: PageModalsProps = {}) {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const { deletingPage, closeDelete } = usePageModal();

  // Delete state
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = async () => {
    if (!deletingPage) {
      return;
    }
    setDeleteLoading(true);
    try {
      const result = await deleteAction(deletingPage.id);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemDeleted', { item: tCommon('entities.page') }),
        tone: 'positive',
      });
      closeDelete();
      (refresh ?? router.refresh)();
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <ConfirmationDialog
      intent="delete"
      opened={!!deletingPage}
      onClose={closeDelete}
      onConfirm={handleDelete}
      title={tCommon('actions.delete')}
      message={
        <DsText>
          {tCommon.rich('messages.confirmDeleteNamedRich', {
            name: deletingPage?.title || tCommon('states.untitled'),
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
