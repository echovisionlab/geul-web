'use client';

import { createCreateDeleteModalContext } from '@/features/admin/modal-context';

export interface SeriesModalTarget {
  id: string;
  title: string;
  slug?: string;
  postCount: number;
  status: string;
}

const modal = createCreateDeleteModalContext<SeriesModalTarget>('Series');

export const SeriesModalProvider = modal.Provider;

export function useSeriesModal() {
  const { deleting, ...actions } = modal.useModal();
  return { deletingSeries: deleting, ...actions };
}
