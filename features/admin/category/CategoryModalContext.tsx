'use client';

import { createCrudModalContext } from '@/features/admin/modal-context';

export interface CategoryModalTarget {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  postCount: number;
  createdAt?: Date;
}

const modal = createCrudModalContext<CategoryModalTarget>('Category');

export const CategoryModalProvider = modal.Provider;

export function useCategoryModal() {
  const { editing, deleting, ...actions } = modal.useModal();
  return { editingCategory: editing, deletingCategory: deleting, ...actions };
}
