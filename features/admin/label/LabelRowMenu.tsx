'use client';
import { List, Text as DsText } from '@/components/core/Typography';
import { ConfirmationDialog } from '@/features/confirmation';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';

import { unwrapQueryResult, type QueryValue } from '@/lib/api/query-result';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { TableRowMenu } from '@/components/core/DataTable';

import { deleteLabelAction, previewDeleteLabelAction } from '@/lib/actions/label';

interface Label {
  id: string;
  name: string;
  slug?: string | null;
}

export interface LabelRowMenuProps {
  previewAction?: typeof previewDeleteLabelAction;
  deleteAction?: typeof deleteLabelAction;
  onDeleted?: (id: string) => void;
  label: Label;
}

export function LabelRowMenu({
  label,
  previewAction = previewDeleteLabelAction,
  deleteAction = deleteLabelAction,
  onDeleted,
}: LabelRowMenuProps) {
  const tCommon = useTranslations('common');
  const tTable = useTranslations('dataTable');
  const router = useRouter();
  const [deleteOpened, setDeleteOpened] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletePreview, setDeletePreview] = useState<QueryValue<
    Awaited<ReturnType<typeof previewDeleteLabelAction>>
  > | null>(null);

  const openDelete = async () => {
    setDeleteLoading(true);
    try {
      const preview = await previewAction(label.id).then(unwrapQueryResult);
      if (!preview) {
        notifications.show({ message: tCommon('messages.failedToLoad'), tone: 'danger' });
        return;
      }
      setDeletePreview(preview);
      setDeleteOpened(true);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      if (!deletePreview) {
        return;
      }
      const result = await deleteAction(label.id, deletePreview.revision);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemDeleted', { item: tCommon('entities.label') }),
        tone: 'positive',
      });
      setDeleteOpened(false);
      setDeletePreview(null);
      if (onDeleted) {
        onDeleted(label.id);
      } else {
        router.refresh();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <TableRowMenu
        aria-label={tTable('aria.rowActions', { label: label.name })}
        items={[
          {
            label: tCommon('actions.edit'),
            icon: <IconEdit size={16} />,
            onClick: () => router.push(`/labels/${label.id}?edit=true`),
          },
          {
            label: tCommon('actions.delete'),
            icon: <IconTrash size={16} />,
            onClick: openDelete,
            tone: 'danger',
          },
        ]}
      />
      <ConfirmationDialog
        intent="delete"
        opened={deleteOpened}
        onClose={() => {
          setDeleteOpened(false);
          setDeletePreview(null);
        }}
        onConfirm={handleDelete}
        title={tCommon('actions.delete')}
        message={
          <DsLayoutStack gap="xs">
            <DsText>
              {tCommon.rich('messages.confirmDeleteNamedRich', {
                name: label.name,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </DsText>
            {deletePreview && deletePreview.impacts.length > 0 ? (
              <>
                <DsText size="sm" tone="warning">
                  {tCommon('messages.relatedItemsWillBeUnlinked', { count: deletePreview.impacts.length })}
                </DsText>
                <List size="sm">
                  {deletePreview.impacts.map((impact) => (
                    <List.Item key={`${impact.kind}-${impact.entityId}`}>{impact.displayName}</List.Item>
                  ))}
                </List>
              </>
            ) : null}
          </DsLayoutStack>
        }
        confirmLabel={tCommon('actions.delete')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={deleteLoading}
      />
    </>
  );
}
