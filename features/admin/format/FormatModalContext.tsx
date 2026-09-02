'use client';

import { createCrudModalContext } from '@/features/admin/modal-context';

export interface FormatModalTarget {
  id: string;
  name: string;
  slug: string;
  releaseCount: number;
}

const modal = createCrudModalContext<FormatModalTarget>('Format');

export const FormatModalProvider = modal.Provider;

export function useFormatModal() {
  const { editing, deleting, ...actions } = modal.useModal();
  return { editingFormat: editing, deletingFormat: deleting, ...actions };
}
