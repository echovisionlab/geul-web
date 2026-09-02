'use client';

import type { CampaignRecipientScope } from '@echovisionlab/geul-common/collaboration/campaign';
import { Stack } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { Select } from '@/components/core/Input';

export interface CampaignRecipientScopeLabels {
  field: string;
  subscribedUsers: string;
  allMatchingUsers: string;
  allMatchingUsersWarning: string;
}

export interface CampaignRecipientScopeControlProps {
  value: CampaignRecipientScope;
  labels: CampaignRecipientScopeLabels;
  disabled?: boolean;
  onChange: (value: CampaignRecipientScope) => void;
}

export function CampaignRecipientScopeControl({
  value,
  labels,
  disabled = false,
  onChange,
}: CampaignRecipientScopeControlProps) {
  return (
    <Stack gap="xs">
      <Select
        aria-label={labels.field}
        data={[
          { value: 'SUBSCRIBED_USERS', label: labels.subscribedUsers },
          { value: 'ALL_MATCHING_USERS', label: labels.allMatchingUsers },
        ]}
        value={value}
        onChange={(nextValue) => {
          if (nextValue === 'SUBSCRIBED_USERS' || nextValue === 'ALL_MATCHING_USERS') {
            onChange(nextValue);
          }
        }}
        disabled={disabled}
        allowDeselect={false}
      />
      {value === 'ALL_MATCHING_USERS' ? <Alert tone="warning">{labels.allMatchingUsersWarning}</Alert> : null}
    </Stack>
  );
}
