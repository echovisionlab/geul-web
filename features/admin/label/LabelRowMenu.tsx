'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { TableRowMenu } from '@/components/core/DataTable';
import { LabelDeleteDialog } from '@/features/label/LabelDeleteDialog';

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
            onClick: () => setDeleteOpened(true),
            tone: 'danger',
          },
        ]}
      />
      <LabelDeleteDialog
        label={deleteOpened ? label : null}
        onClose={() => setDeleteOpened(false)}
        onDeleted={() => {
          setDeleteOpened(false);
          if (onDeleted) {
            onDeleted(label.id);
          } else {
            router.refresh();
          }
        }}
        previewAction={previewAction}
        deleteAction={deleteAction}
      />
    </>
  );
}
