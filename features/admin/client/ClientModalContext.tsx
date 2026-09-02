'use client';

import { createDeleteModalContext } from '@/features/admin/modal-context';

export interface ClientModalTarget {
  id: string;
  name: string;
}

const modal = createDeleteModalContext<ClientModalTarget>('Client');

export const ClientModalProvider = modal.Provider;

export function useClientModal() {
  const { deleting, openDelete, closeDelete } = modal.useModal();
  return { deletingClient: deleting, openDelete, closeDelete };
}
