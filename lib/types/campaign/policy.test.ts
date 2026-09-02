import { describe, expect, it } from 'vitest';
import type { CampaignStatus } from './model';
import {
  canCancelScheduledCampaignStatus,
  canEditCampaignStatus,
  canScheduleCampaignStatus,
  canSendCampaignNowStatus,
} from './policy';

const statuses: CampaignStatus[] = ['draft', 'scheduled', 'sending', 'sent', 'failed'];

describe('campaign status policy', () => {
  it.each(statuses)('matches edit policy for %s', (status) => {
    expect(canEditCampaignStatus(status)).toBe(status === 'draft');
  });

  it.each(statuses)('matches schedule policy for %s', (status) => {
    expect(canScheduleCampaignStatus(status)).toBe(status === 'draft');
  });

  it.each(statuses)('matches send-now policy for %s', (status) => {
    expect(canSendCampaignNowStatus(status)).toBe(status === 'draft');
  });

  it.each(statuses)('matches cancel-schedule policy for %s', (status) => {
    expect(canCancelScheduledCampaignStatus(status)).toBe(status === 'scheduled');
  });
});
