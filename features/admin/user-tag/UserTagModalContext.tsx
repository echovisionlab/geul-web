'use client';

import { createCreateDeleteModalContext } from '@/features/admin/modal-context';

export interface UserTagModalTarget {
  id: string;
  name: string;
  user_count: number;
}

const modal = createCreateDeleteModalContext<UserTagModalTarget>('UserTag');

export const UserTagModalProvider = modal.Provider;

export function useUserTagModal() {
  const { deleting, ...actions } = modal.useModal();
  return { deletingTag: deleting, ...actions };
}
