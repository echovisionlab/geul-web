'use client';

import { createDeleteModalContext } from '@/features/admin/modal-context';

export interface ArtistModalTarget {
  id: string;
  name: string;
  slug: string | null;
  status: string;
}

const modal = createDeleteModalContext<ArtistModalTarget>('Artist');

export const ArtistModalProvider = modal.Provider;

export function useArtistModal() {
  const { deleting, openDelete, closeDelete } = modal.useModal();
  return { deletingArtist: deleting, openDelete, closeDelete };
}
