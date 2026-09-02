'use client';

import { EntityRowMenu } from '@/features/admin/EntityRowMenu';
import { useFormatModal, type FormatModalTarget } from './FormatModalContext';

interface FormatRowMenuProps {
  format: FormatModalTarget;
}

export function FormatRowMenu({ format }: FormatRowMenuProps) {
  const { openEdit, openDelete } = useFormatModal();
  return <EntityRowMenu entity={format} label={format.name} onEdit={openEdit} onDelete={openDelete} />;
}
