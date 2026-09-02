import type { ValueType } from '../common/filter';

// Filter/Sort field definitions for DataTable
export const campaignFilterFields = {
  id: 'uuid',
  name: 'string',
  subject: 'string',
  status: 'string',
  sent_at: 'date',
  created_at: 'date',
} as const satisfies Record<string, ValueType>;

export const campaignSortFields = ['name', 'subject', 'created_at', 'sent_at', 'sentCount', 'status'] as const;

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';

export interface CampaignListItem {
  id: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  sentAt: Date | null;
  sentCount: number;
  createdAt: Date;
}
