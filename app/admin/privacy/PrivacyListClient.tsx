'use client';

import type { ComponentProps } from 'react';
import { useTranslations } from 'next-intl';
import { LegalPolicyListClient, type LegalPolicyListItem } from '@/features/policy/LegalPolicyListClient';
import { createPrivacyVersionAction, deletePrivacyVersionAction } from '@/lib/actions/privacy';
import { getPrivacyStatusColor, isPrivacyDraft, isPrivacyScheduled, PRIVACY_STATUS } from '@/lib/policy-status';

export function PrivacyListClient({
  initialVersions,
  createVersion = createPrivacyVersionAction,
  deleteVersion = deletePrivacyVersionAction,
}: {
  initialVersions: LegalPolicyListItem[];
  createVersion?: ComponentProps<typeof LegalPolicyListClient>['createVersion'];
  deleteVersion?: ComponentProps<typeof LegalPolicyListClient>['deleteVersion'];
}) {
  const tCommon = useTranslations('common');
  return (
    <LegalPolicyListClient
      policy="privacy"
      initialVersions={initialVersions}
      status={{
        draft: PRIVACY_STATUS.DRAFT,
        scheduled: PRIVACY_STATUS.SCHEDULED,
        active: PRIVACY_STATUS.ACTIVE,
        archived: PRIVACY_STATUS.ARCHIVED,
        isDraft: isPrivacyDraft,
        isScheduled: isPrivacyScheduled,
        getColor: getPrivacyStatusColor,
      }}
      createVersion={createVersion}
      deleteVersion={deleteVersion}
      searchPlaceholder={tCommon('placeholders.search')}
    />
  );
}
