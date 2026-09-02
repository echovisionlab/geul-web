import type { CampaignStatus } from './model';

export function canEditCampaignStatus(status: CampaignStatus): boolean {
  return status === 'draft';
}

export function canScheduleCampaignStatus(status: CampaignStatus): boolean {
  return status === 'draft';
}

export function canSendCampaignNowStatus(status: CampaignStatus): boolean {
  return status === 'draft';
}

export function canCancelScheduledCampaignStatus(status: CampaignStatus): boolean {
  return status === 'scheduled';
}
