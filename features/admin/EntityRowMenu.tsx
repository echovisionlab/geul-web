'use client';

import { IconEdit, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { TableRowMenu } from '@/components/core/DataTable';

interface EntityRowMenuProps<TEntity> {
  entity: TEntity;
  label: string;
  editHref?: string;
  onEdit?: (entity: TEntity) => void;
  onDelete: (entity: TEntity) => void;
}

export function EntityRowMenu<TEntity>({ entity, label, editHref, onEdit, onDelete }: EntityRowMenuProps<TEntity>) {
  const tCommon = useTranslations('common');
  const tTable = useTranslations('dataTable');

  return (
    <TableRowMenu
      aria-label={tTable('aria.rowActions', { label })}
      items={[
        {
          label: tCommon('actions.edit'),
          icon: <IconEdit size={16} />,
          href: editHref,
          onClick: onEdit ? () => onEdit(entity) : undefined,
        },
        {
          label: tCommon('actions.delete'),
          icon: <IconTrash size={16} />,
          onClick: () => onDelete(entity),
          color: 'red',
        },
      ]}
    />
  );
}
