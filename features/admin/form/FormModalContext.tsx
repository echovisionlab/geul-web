'use client';

import { createDeleteModalContext } from '@/features/admin/modal-context';

export interface FormModalTarget {
  id: string;
  title: string;
  slug?: string;
}

const modal = createDeleteModalContext<FormModalTarget>('Form');

export const FormModalProvider = modal.Provider;

export function useFormModal() {
  const { deleting, openDelete, closeDelete } = modal.useModal();
  return { deletingForm: deleting, openDelete, closeDelete };
}
