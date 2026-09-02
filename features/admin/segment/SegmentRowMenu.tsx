'use client';

import { IconArchive, IconPencil, IconRestore } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { TableRowMenu } from '@/components/core/DataTable';
import { useSegmentModal } from './SegmentModalContext';
import type { AudienceSegmentRow } from './model';

interface SegmentRowMenuProps {
  segment: AudienceSegmentRow;
}

export function SegmentRowMenu({ segment }: SegmentRowMenuProps) {
  const tCommon = useTranslations('common');
  const tTable = useTranslations('dataTable');
  const tPage = useTranslations('adminList.audienceSegments');
  const { openArchive, openEdit, openRestore } = useSegmentModal();

  const lifecycleItem = segment.archived_at
    ? {
        label: tPage('restore'),
        icon: <IconRestore size={16} />,
        onClick: () => openRestore(segment),
      }
    : {
        label: tPage('archive'),
        icon: <IconArchive size={16} />,
        onClick: () => openArchive(segment),
        color: 'orange' as const,
      };

  return (
    <TableRowMenu
      aria-label={tTable('aria.rowActions', { label: segment.name })}
      items={[
        ...(segment.archived_at
          ? []
          : [
              {
                label: tCommon('actions.edit'),
                icon: <IconPencil size={16} />,
                onClick: () => openEdit(segment.id),
              },
            ]),
        lifecycleItem,
      ]}
    />
  );
}
