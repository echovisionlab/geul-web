'use client';

import { IconArchive, IconPencil, IconRestore } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { TableRowMenu } from '@/components/core/DataTable';
import { useCriteriaModal } from './MemberCriteriaModalContext';
import type { MemberCriteriaRow } from './model';

interface MemberCriteriaRowMenuProps {
  criteria: MemberCriteriaRow;
}

export function MemberCriteriaRowMenu({ criteria }: MemberCriteriaRowMenuProps) {
  const tCommon = useTranslations('common');
  const tTable = useTranslations('dataTable');
  const tPage = useTranslations('adminList.memberCriteria');
  const { openArchive, openEdit, openRestore } = useCriteriaModal();

  const lifecycleItem = criteria.archived_at
    ? {
        label: tPage('restore'),
        icon: <IconRestore size={16} />,
        onClick: () => openRestore(criteria),
      }
    : {
        label: tPage('archive'),
        icon: <IconArchive size={16} />,
        onClick: () => openArchive(criteria),
        tone: 'warning' as const,
      };

  return (
    <TableRowMenu
      aria-label={tTable('aria.rowActions', { label: criteria.name })}
      items={[
        ...(criteria.archived_at
          ? []
          : [
              {
                label: tCommon('actions.edit'),
                icon: <IconPencil size={16} />,
                onClick: () => openEdit(criteria.id),
              },
            ]),
        lifecycleItem,
      ]}
    />
  );
}
