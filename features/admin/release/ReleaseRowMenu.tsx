'use client';

import { IconEdit, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { TableRowMenu } from '@/components/core/DataTable';
import { useReleaseModal, type ReleaseModalTarget } from './ReleaseModalContext';

interface ReleaseRowMenuProps {
  release: ReleaseModalTarget;
}

export function ReleaseRowMenu({ release }: ReleaseRowMenuProps) {
  const tCommon = useTranslations('common');
  const tTable = useTranslations('dataTable');
  const { openDelete } = useReleaseModal();
  const label = release.title || tCommon('states.untitled');

  return (
    <TableRowMenu
      aria-label={tTable('aria.rowActions', { label })}
      items={[
        {
          label: tCommon('actions.edit'),
          icon: <IconEdit size={16} />,
          href: `/releases/${release.id}?edit=true`,
        },
        {
          label: tCommon('actions.delete'),
          icon: <IconTrash size={16} />,
          onClick: () => openDelete(release),
          color: 'red',
        },
      ]}
    />
  );
}
