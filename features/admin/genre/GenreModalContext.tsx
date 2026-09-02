'use client';

import { createCrudModalContext } from '@/features/admin/modal-context';

export interface GenreModalTarget {
  id: string;
  name: string;
  slug: string;
  description: string | undefined;
  releaseCount: number;
  createdAt: Date | undefined;
}

const modal = createCrudModalContext<GenreModalTarget>('Genre');

export const GenreModalProvider = modal.Provider;

export function useGenreModal() {
  const { editing, deleting, ...actions } = modal.useModal();
  return { editingGenre: editing, deletingGenre: deleting, ...actions };
}
