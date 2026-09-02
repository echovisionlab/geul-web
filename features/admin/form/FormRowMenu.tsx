'use client';

import { IconEdit, IconEye, IconSettings, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { TableRowMenu, type TableRowMenuItem } from '@/components/core/DataTable';
import { useFormModal, type FormModalTarget } from './FormModalContext';

interface FormRowMenuProps {
  form: FormModalTarget;
  basePath?: string;
  canDelete?: boolean;
}

export function FormRowMenu({ form, basePath: _basePath = '/admin/forms', canDelete = true }: FormRowMenuProps) {
  const tCommon = useTranslations('common');
  const tTable = useTranslations('dataTable');
  const { openDelete } = useFormModal();

  const items: TableRowMenuItem[] = [
    {
      label: tCommon('actions.edit'),
      icon: <IconEdit size={16} />,
      href: `/forms/${encodeURIComponent(form.id)}?edit=true`,
    },
    {
      label: tCommon('labels.submissions'),
      icon: <IconEye size={16} />,
      href: `/forms/${encodeURIComponent(form.id)}?edit=true&tab=submissions`,
    },
    {
      label: tCommon('labels.settings'),
      icon: <IconSettings size={16} />,
      href: `/forms/${encodeURIComponent(form.id)}?edit=true&tab=settings`,
    },
  ];

  if (canDelete) {
    items.push({
      label: tCommon('actions.delete'),
      icon: <IconTrash size={16} />,
      onClick: () => openDelete(form),
      color: 'red',
    });
  }

  return <TableRowMenu aria-label={tTable('aria.rowActions', { label: form.title })} items={items} />;
}
