'use client';

import { EntityRowMenu } from '@/features/admin/EntityRowMenu';
import { useStyleModal, type StyleModalTarget } from './StyleModalContext';

interface StyleRowMenuProps {
  style: StyleModalTarget;
}

export function StyleRowMenu({ style }: StyleRowMenuProps) {
  const { openEdit, openDelete } = useStyleModal();
  return <EntityRowMenu entity={style} label={style.name} onEdit={openEdit} onDelete={openDelete} />;
}
