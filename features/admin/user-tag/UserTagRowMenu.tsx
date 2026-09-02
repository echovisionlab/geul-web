'use client';

import { IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { TableRowMenu } from '@/components/core/DataTable';
import { useUserTagModal, type UserTagModalTarget } from './UserTagModalContext';

interface UserTagRowMenuProps {
  tag: UserTagModalTarget;
}

export function UserTagRowMenu({ tag }: UserTagRowMenuProps) {
  const tCommon = useTranslations('common');
  const tTable = useTranslations('dataTable');
  const { openDelete } = useUserTagModal();

  return (
    <TableRowMenu
      aria-label={tTable('aria.rowActions', { label: tag.name })}
      items={[
        {
          label: tCommon('actions.delete'),
          icon: <IconTrash size={16} />,
          onClick: () => openDelete(tag),
          color: 'red',
        },
      ]}
    />
  );
}
