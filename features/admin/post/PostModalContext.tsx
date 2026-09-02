'use client';

import { createDeleteModalContext } from '@/features/admin/modal-context';

export interface PostModalTarget {
  id: string;
  title: string;
  slug: string | undefined;
  status: string;
}

const modal = createDeleteModalContext<PostModalTarget>('Post');

export const PostModalProvider = modal.Provider;

export function usePostModal() {
  const { deleting, openDelete, closeDelete } = modal.useModal();
  return { deletingPost: deleting, openDelete, closeDelete };
}
