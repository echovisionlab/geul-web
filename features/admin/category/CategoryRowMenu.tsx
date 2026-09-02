'use client';

import { EntityRowMenu } from '@/features/admin/EntityRowMenu';
import { useCategoryModal, type CategoryModalTarget } from './CategoryModalContext';

interface CategoryRowMenuProps {
  category: CategoryModalTarget;
}

export function CategoryRowMenu({ category }: CategoryRowMenuProps) {
  const { openEdit, openDelete } = useCategoryModal();
  return <EntityRowMenu entity={category} label={category.name} onEdit={openEdit} onDelete={openDelete} />;
}
