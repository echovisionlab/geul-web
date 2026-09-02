import { CampaignTargetMode } from '@echovisionlab/geul-proto/secure/campaign_pb.ts';
import { campaignRecipientScopeSchema } from '@echovisionlab/geul-common/collaboration/campaign';
import { z } from 'zod';

export const CampaignFieldsSchema = z.object({
  targetMode: z.union([z.literal(CampaignTargetMode.ALL), z.literal(CampaignTargetMode.SEGMENT)]),
  segmentId: z.string().nullable(),
  layoutId: z.string().nullable(),
  recipientScope: campaignRecipientScopeSchema,
});

export type CampaignFields = z.infer<typeof CampaignFieldsSchema>;

export const DEFAULT_CAMPAIGN_FIELDS: CampaignFields = {
  targetMode: CampaignTargetMode.ALL,
  segmentId: null,
  layoutId: null,
  recipientScope: 'SUBSCRIBED_USERS',
};

export const CAMPAIGN_FIELDS_JSON_KEYS: ReadonlySet<keyof CampaignFields> = new Set([]);
