import { CampaignTargetMode } from '@echovisionlab/geul-proto/secure/campaign_pb.ts';
import { campaignRecipientScopeSchema } from '@echovisionlab/geul-common/collaboration/campaign';
import * as z from '@/lib/zod-mini';

export const CampaignFieldsSchema = z.object({
  targetMode: z.union([z.literal(CampaignTargetMode.ALL), z.literal(CampaignTargetMode.MEMBER_CRITERIA)]),
  memberCriteriaId: z.nullable(z.string()),
  layoutId: z.nullable(z.string()),
  recipientScope: campaignRecipientScopeSchema,
});

export type CampaignFields = z.infer<typeof CampaignFieldsSchema>;

export const DEFAULT_CAMPAIGN_FIELDS: CampaignFields = {
  targetMode: CampaignTargetMode.ALL,
  memberCriteriaId: null,
  layoutId: null,
  recipientScope: 'SUBSCRIBED_USERS',
};

export const CAMPAIGN_FIELDS_JSON_KEYS: ReadonlySet<keyof CampaignFields> = new Set([]);
