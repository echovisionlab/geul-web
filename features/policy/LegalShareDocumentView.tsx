'use client';

import { IconCalendar } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Group, Stack, Title } from '@mantine/core';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { Alert } from '@/components/core/Alert';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { LegalDocumentMetadata } from '@/features/policy/LegalDocumentMetadata';
import { PrintButton } from '@/features/print/PrintButton';
import type { PublicLocalizationInfoLike } from '@/lib/queries/localized-public';
import { LegalRichTextContent } from './LegalRichTextContent';
import { LegalTranslationNotice } from './LegalTranslationNotice';
import classes from './LegalDocumentView.module.css';

export interface LegalShareDocument {
  entityType: 'privacy' | 'terms';
  title: string;
  content: readonly LocalizedRichTextBlock[];
  version: number;
  effectiveFrom: string | null;
  effectiveUntil?: string | null;
  localizationInfo?: PublicLocalizationInfoLike | null;
}

export function LegalShareDocumentView({ document, pathname }: { document: LegalShareDocument; pathname: string }) {
  const dateTime = useDateTimeFormatter();
  const tLegalPage = useTranslations('legalPageCommon');

  return (
    <Stack gap="md" className={classes.document} data-legal-document={document.entityType}>
      <LegalTranslationNotice pathname={pathname} localizationInfo={document.localizationInfo} />
      {document.effectiveFrom && !document.effectiveUntil ? (
        <Alert icon={<IconCalendar size={16} />} tone="accent" className={classes.notice}>
          {tLegalPage('preview.upcomingAlert', {
            date: dateTime.date(document.effectiveFrom, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
          })}
        </Alert>
      ) : null}
      <Group justify="space-between" align="flex-start" className={classes.header}>
        <Stack gap="xs" className={classes.title}>
          <Title order={1}>{document.title}</Title>
          <LegalDocumentMetadata
            version={document.version}
            effectiveFrom={document.effectiveFrom}
            effectiveUntil={document.effectiveUntil}
          />
        </Stack>
        <PrintButton />
      </Group>
      <LegalRichTextContent
        blocks={document.content}
        className={`prose ${document.entityType}-content ${classes.content}`}
      />
    </Stack>
  );
}
