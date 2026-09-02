'use client';

import { IconEye, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { TableRowMenu, type TableRowMenuItem } from '@/components/core/DataTable';
import { buildPagePath } from '@/lib/utils/page-route';
import { usePageModal, type PageModalTarget } from './PageModalContext';

interface PageRowMenuProps {
  page: PageModalTarget;
}

export function PageRowMenu({ page }: PageRowMenuProps) {
  const tCommon = useTranslations('common.actions');
  const tDataTable = useTranslations('dataTable.aria');
  const { openDelete } = usePageModal();

  const items: TableRowMenuItem[] = [];

  // Published Pages remain publicly addressable by their UUID when no slug is set.
  if (page.status === 'published') {
    items.push({
      label: tCommon('view'),
      icon: <IconEye size={16} />,
      href: buildPagePath(page.slug || page.id),
    });
  }

  items.push({
    label: tCommon('delete'),
    icon: <IconTrash size={16} />,
    onClick: () => openDelete(page),
    color: 'red',
  });

  return <TableRowMenu aria-label={tDataTable('rowActions', { label: page.title || 'page' })} items={items} />;
}
