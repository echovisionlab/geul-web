'use client';

import { useSearchParams } from 'next/navigation';
import { resolveContentRequestedLocale } from '@/lib/translation/content-language';
import type { PublicLegalHistoryInitialData } from '@/lib/queries/legal-history';
import { useLocale, useTranslations } from 'next-intl';
import { LegalPolicyHistoryClient } from '@/features/policy/LegalPolicyHistoryClient';
import { getActiveTerms, listArchivedTerms } from '@/lib/queries/terms-browser';

export function TermsHistoryClient({ initialData }: { initialData?: PublicLegalHistoryInitialData }) {
  const requestedLocale = resolveContentRequestedLocale(useLocale(), Object.fromEntries(useSearchParams().entries()));
  const t = useTranslations('termsHistory');
  const common = useTranslations('legalHistoryCommon');
  const actions = useTranslations('common.actions');
  const statuses = useTranslations('common.statuses');
  const labels = useTranslations('common.labels');
  const messages = useTranslations('common.messages');
  const states = useTranslations('common.states');

  return (
    <LegalPolicyHistoryClient
      policy="terms"
      requestedLocale={requestedLocale}
      initialData={initialData}
      getActive={getActiveTerms}
      listArchived={listArchivedTerms}
      labels={{
        title: t('title'),
        back: actions('backToTermsOfService'),
        noVersions: messages('noVersionsFound'),
        version: labels('version'),
        status: labels('status'),
        current: statuses('current'),
        archived: statuses('archived'),
        effectivePeriod: common('columns.effectivePeriod'),
        notAvailable: states('notAvailable'),
        openDateRange: (from) => common('dateRangeOpen', { from }),
        closedDateRange: (from, until) => common('dateRangeClosed', { from, until }),
      }}
    />
  );
}
