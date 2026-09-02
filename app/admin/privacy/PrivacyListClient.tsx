'use client';

import { useTranslations } from 'next-intl';
import { LegalPolicyListClient, type LegalPolicyListItem } from '@/features/policy/LegalPolicyListClient';
import { createPrivacyVersionAction, deletePrivacyVersionAction } from '@/lib/actions/privacy';
import { getPrivacyStatusColor, isPrivacyDraft, isPrivacyScheduled, PRIVACY_STATUS } from '@/lib/policy-status';

export function PrivacyListClient({ initialVersions }: { initialVersions: LegalPolicyListItem[] }) {
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
      createVersion={createPrivacyVersionAction}
      deleteVersion={deletePrivacyVersionAction}
      searchPlaceholder={tCommon('placeholders.search')}
    />
  );
}
