'use client';

import { createDeleteModalContext } from '@/features/admin/modal-context';

export interface CampaignModalTarget {
  id: string;
  name: string;
  subject: string;
  status: string;
}

const modal = createDeleteModalContext<CampaignModalTarget>('Campaign');

export const CampaignModalProvider = modal.Provider;

export function useCampaignModal() {
  const { deleting, openDelete, closeDelete } = modal.useModal();
  return { deletingCampaign: deleting, openDelete, closeDelete };
}
