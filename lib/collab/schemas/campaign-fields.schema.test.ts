import { CampaignTargetMode } from '@echovisionlab/geul-proto/secure/campaign_pb.ts';
import { describe, expect, it } from 'vitest';
import { CampaignFieldsSchema, DEFAULT_CAMPAIGN_FIELDS } from './campaign-fields.schema';

describe('campaign fields schema', () => {
  it('defaults to an explicit all-recipient target', () => {
    expect(DEFAULT_CAMPAIGN_FIELDS).toMatchObject({
      targetMode: CampaignTargetMode.ALL,
      memberCriteriaId: null,
      recipientScope: 'SUBSCRIBED_USERS',
    });
  });

  it('requires one canonical recipient scope', () => {
    const { recipientScope: _recipientScope, ...withoutRecipientScope } = DEFAULT_CAMPAIGN_FIELDS;
    expect(CampaignFieldsSchema.safeParse(withoutRecipientScope).success).toBe(false);
    expect(
      CampaignFieldsSchema.safeParse({
        ...withoutRecipientScope,
        recipientScope: 'SUBSCRIBED_USERS',
      }).success,
    ).toBe(true);
    expect(
      CampaignFieldsSchema.safeParse({
        ...withoutRecipientScope,
        recipientScope: 'ALL_MATCHING_USERS',
      }).success,
    ).toBe(true);
  });

  it('rejects the unspecified campaign target mode', () => {
    expect(
      CampaignFieldsSchema.safeParse({
        ...DEFAULT_CAMPAIGN_FIELDS,
        targetMode: CampaignTargetMode.UNSPECIFIED,
      }).success,
    ).toBe(false);
  });
});
