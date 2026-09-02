'use client';

import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import classes from './LegalDocumentView.module.css';

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
    <div className={classes.metadata}>
      <Text size="sm" c="dimmed">
        {tLabels('version')} {version}
      </Text>
      {effectiveFrom ? (
        <Text size="sm" c="dimmed">
          {tMessages('effectiveFromDate', {
            date: dateTime.date(effectiveFrom, { year: 'numeric', month: 'long', day: 'numeric' }),
          })}
        </Text>
      ) : null}
      {effectiveUntil ? (
        <Text size="sm" c="dimmed">
          {tHistory('effectiveUntil', {
            date: dateTime.date(effectiveUntil, { year: 'numeric', month: 'long', day: 'numeric' }),
          })}
        </Text>
      ) : null}
    </div>
  );
}
