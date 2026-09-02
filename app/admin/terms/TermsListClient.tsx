'use client';

import { useTranslations } from 'next-intl';
import { LegalPolicyListClient, type LegalPolicyListItem } from '@/features/policy/LegalPolicyListClient';
import { createTermsVersionAction, deleteTermsVersionAction } from '@/lib/actions/terms';
import { getTermsStatusColor, isTermsDraft, isTermsScheduled, TERMS_STATUS } from '@/lib/policy-status';

export function TermsListClient({ initialVersions }: { initialVersions: LegalPolicyListItem[] }) {
  const tPage = useTranslations('adminList.terms');
  return (
    <LegalPolicyListClient
      policy="terms"
      initialVersions={initialVersions}
      status={{
        draft: TERMS_STATUS.DRAFT,
        scheduled: TERMS_STATUS.SCHEDULED,
        active: TERMS_STATUS.ACTIVE,
        archived: TERMS_STATUS.ARCHIVED,
        isDraft: isTermsDraft,
        isScheduled: isTermsScheduled,
        getColor: getTermsStatusColor,
      }}
      createVersion={createTermsVersionAction}
      deleteVersion={deleteTermsVersionAction}
      searchPlaceholder={tPage('searchPlaceholder')}
    />
  );
}
