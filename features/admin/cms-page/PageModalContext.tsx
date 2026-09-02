'use client';

import { createDeleteModalContext } from '@/features/admin/modal-context';

export interface PageModalTarget {
  id: string;
  title: string;
  slug: string | null;
  status: string;
}

const modal = createDeleteModalContext<PageModalTarget>('Page');

export const PageModalProvider = modal.Provider;

export function usePageModal() {
  const { deleting, openDelete, closeDelete } = modal.useModal();
  return { deletingPage: deleting, openDelete, closeDelete };
}
