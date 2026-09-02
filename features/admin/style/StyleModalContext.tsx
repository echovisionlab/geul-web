'use client';

import { createCrudModalContext } from '@/features/admin/modal-context';

export interface StyleModalTarget {
  id: string;
  name: string;
  slug: string;
  description?: string;
  releaseCount: number;
  createdAt?: Date;
}

const modal = createCrudModalContext<StyleModalTarget>('Style');

export const StyleModalProvider = modal.Provider;

export function useStyleModal() {
  const { editing, deleting, ...actions } = modal.useModal();
  return { editingStyle: editing, deletingStyle: deleting, ...actions };
}
