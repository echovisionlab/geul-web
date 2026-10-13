'use client';

import { Text as DsText } from '@/components/core/Typography';
import { useTranslations } from 'next-intl';

import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { LayoutInline } from '@/components/core/Layout';

type LegalDocumentDate = Date | string | null | undefined;

interface LegalDocumentMetadataProps {
  version: number;
  effectiveFrom?: LegalDocumentDate;
  effectiveUntil?: LegalDocumentDate;
}

export function LegalDocumentMetadata({ version, effectiveFrom, effectiveUntil }: LegalDocumentMetadataProps) {
  const dateTime = useDateTimeFormatter();
  const tLabels = useTranslations('common.labels');
  const tMessages = useTranslations('common.messages');
  const tHistory = useTranslations('legalHistoryDetailCommon');

  return (
    <LayoutInline gap="md" wrap="wrap">
      <DsText size="sm" tone="secondary">
        {tLabels('version')} {version}
      </DsText>
      {effectiveFrom ? (
        <DsText size="sm" tone="secondary">
          {tMessages('effectiveFromDate', {
            date: dateTime.date(effectiveFrom, { year: 'numeric', month: 'long', day: 'numeric' }),
          })}
        </DsText>
      ) : null}
      {effectiveUntil ? (
        <DsText size="sm" tone="secondary">
          {tHistory('effectiveUntil', {
            date: dateTime.date(effectiveUntil, { year: 'numeric', month: 'long', day: 'numeric' }),
          })}
        </DsText>
      ) : null}
    </LayoutInline>
  );
}
