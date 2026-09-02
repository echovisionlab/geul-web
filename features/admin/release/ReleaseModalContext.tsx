'use client';

import { createDeleteModalContext } from '@/features/admin/modal-context';

export interface ReleaseModalTarget {
  id: string;
  title: string;
  slug?: string | null;
}

const modal = createDeleteModalContext<ReleaseModalTarget>('Release');

export const ReleaseModalProvider = modal.Provider;

export function useReleaseModal() {
  const { deleting, openDelete, closeDelete } = modal.useModal();
  return { deletingRelease: deleting, openDelete, closeDelete };
}
