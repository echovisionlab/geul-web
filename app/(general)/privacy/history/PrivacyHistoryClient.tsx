'use client';

import { useSearchParams } from 'next/navigation';
import { resolveContentRequestedLocale } from '@/lib/translation/content-language';
import type { PublicLegalHistoryInitialData } from '@/lib/queries/legal-history';
import { useLocale, useTranslations } from 'next-intl';
import { LegalPolicyHistoryClient } from '@/features/policy/LegalPolicyHistoryClient';
import { getActivePrivacy, listArchivedPrivacy } from '@/lib/queries/privacy-browser';

export function PrivacyHistoryClient({ initialData }: { initialData?: PublicLegalHistoryInitialData }) {
  const requestedLocale = resolveContentRequestedLocale(useLocale(), Object.fromEntries(useSearchParams().entries()));
  const t = useTranslations('privacyHistory');
  const common = useTranslations('legalHistoryCommon');
  const actions = useTranslations('common.actions');
  const statuses = useTranslations('common.statuses');
  const labels = useTranslations('common.labels');
  const messages = useTranslations('common.messages');
  const states = useTranslations('common.states');

  return (
    <LegalPolicyHistoryClient
      policy="privacy"
      requestedLocale={requestedLocale}
      initialData={initialData}
      getActive={getActivePrivacy}
      listArchived={listArchivedPrivacy}
      labels={{
        title: t('title'),
        back: actions('backToPrivacyPolicy'),
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
