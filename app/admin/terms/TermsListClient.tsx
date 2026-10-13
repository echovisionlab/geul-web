'use client';

import type { ComponentProps } from 'react';
import { useTranslations } from 'next-intl';
import { LegalPolicyListClient, type LegalPolicyListItem } from '@/features/policy/LegalPolicyListClient';
import { createTermsVersionAction, deleteTermsVersionAction } from '@/lib/actions/terms';
import { getTermsStatusColor, isTermsDraft, isTermsScheduled, TERMS_STATUS } from '@/lib/policy-status';

export function TermsListClient({
  initialVersions,
  createVersion = createTermsVersionAction,
  deleteVersion = deleteTermsVersionAction,
}: {
  initialVersions: LegalPolicyListItem[];
  createVersion?: ComponentProps<typeof LegalPolicyListClient>['createVersion'];
  deleteVersion?: ComponentProps<typeof LegalPolicyListClient>['deleteVersion'];
}) {
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
      createVersion={createVersion}
      deleteVersion={deleteVersion}
      searchPlaceholder={tPage('searchPlaceholder')}
    />
  );
}
