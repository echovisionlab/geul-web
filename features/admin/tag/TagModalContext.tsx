'use client';

import { createCrudModalContext } from '@/features/admin/modal-context';

export interface TagModalTarget {
  id: string;
  name: string;
  slug?: string;
  postCount: number;
  createdAt?: Date;
}

const modal = createCrudModalContext<TagModalTarget>('Tag');

export const TagModalProvider = modal.Provider;

export function useTagModal() {
  const { editing, deleting, ...actions } = modal.useModal();
  return { editingTag: editing, deletingTag: deleting, ...actions };
}
