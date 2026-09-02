'use client';

import { useTranslations } from 'next-intl';
import { LegalPolicyHistoryClient } from '@/features/policy/LegalPolicyHistoryClient';
import { getActiveTerms, listArchivedTerms } from '@/lib/queries/terms-browser';

export function TermsHistoryClient() {
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
