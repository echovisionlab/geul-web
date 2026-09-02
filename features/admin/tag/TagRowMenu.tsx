'use client';

import { EntityRowMenu } from '@/features/admin/EntityRowMenu';
import { useTagModal, type TagModalTarget } from './TagModalContext';

interface TagRowMenuProps {
  tag: TagModalTarget;
}

export function TagRowMenu({ tag }: TagRowMenuProps) {
  const { openEdit, openDelete } = useTagModal();
  return <EntityRowMenu entity={tag} label={tag.name} onEdit={openEdit} onDelete={openDelete} />;
}
