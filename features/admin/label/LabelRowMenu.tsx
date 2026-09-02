'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { List, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { TableRowMenu } from '@/components/core/DataTable';
import { ConfirmModal } from '@/components/core/Modal';
import { deleteLabelAction, previewDeleteLabelAction } from '@/lib/actions/label';

interface Label {
  id: string;
  name: string;
  slug?: string | null;
}

interface LabelRowMenuProps {
  label: Label;
}

export function LabelRowMenu({ label }: LabelRowMenuProps) {
  const tCommon = useTranslations('common');
  const tTable = useTranslations('dataTable');
  const router = useRouter();
  const [deleteOpened, setDeleteOpened] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletePreview, setDeletePreview] = useState<Awaited<ReturnType<typeof previewDeleteLabelAction>>>(null);

  const openDelete = async () => {
    setDeleteLoading(true);
    try {
      const preview = await previewDeleteLabelAction(label.id);
      if (!preview) {
        notifications.show({ message: tCommon('messages.failedToLoad'), color: 'red' });
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
      const result = await deleteLabelAction(label.id, deletePreview.revision);
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemDeleted', { item: tCommon('entities.label') }),
        color: 'red',
      });
      setDeleteOpened(false);
      setDeletePreview(null);
      router.refresh();
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
            color: 'red',
          },
        ]}
      />
      <ConfirmModal
        opened={deleteOpened}
        onClose={() => {
          setDeleteOpened(false);
          setDeletePreview(null);
        }}
        onConfirm={handleDelete}
        title={tCommon('actions.delete')}
        message={
          <Stack gap="xs">
            <Text>
              {tCommon.rich('messages.confirmDeleteNamedRich', {
                name: label.name,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </Text>
            {deletePreview && deletePreview.impacts.length > 0 ? (
              <>
                <Text size="sm" c="dimmed">
                  {tCommon('messages.relatedItemsWillBeUnlinked', { count: deletePreview.impacts.length })}
                </Text>
                <List size="sm">
                  {deletePreview.impacts.map((impact) => (
                    <List.Item key={`${impact.kind}-${impact.entityId}`}>{impact.displayName}</List.Item>
                  ))}
                </List>
              </>
            ) : null}
          </Stack>
        }
        confirmLabel={tCommon('actions.delete')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={deleteLoading}
      />
    </>
  );
}
