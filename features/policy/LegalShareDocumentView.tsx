'use client';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Heading as DsHeading } from '@/components/core/Typography';
import { IconCalendar } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { Alert } from '@/components/core/Alert';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { LegalDocumentMetadata } from '@/features/policy/LegalDocumentMetadata';
import { PrintButton } from '@/features/print/PrintButton';
import type { PublicLocalizationInfoLike } from '@/lib/queries/localized-public';
import { LegalDocumentLayout } from './LegalDocumentLayout';
import { ContentLocaleNotice } from '@/features/translation/ContentLocaleNotice';
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
    <LegalDocumentLayout
      data-legal-document={document.entityType}
      blocks={document.content}
      requestedLocale={document.localizationInfo?.requestedLocale}
      contentLocale={document.localizationInfo?.displayedLocale || document.localizationInfo?.sourceLocale}
      contentClassName={`prose ${document.entityType}-content ${classes.content}`}
      empty={null}
      header={
        <DsLayoutStack printFlow="stack" gap="md">
          <ContentLocaleNotice announceTranslation pathname={pathname} localizationInfo={document.localizationInfo} />
          {document.effectiveFrom && !document.effectiveUntil ? (
            <div className={classes.notice}>
              <Alert icon={<IconCalendar size={16} />} tone="accent">
                {tLegalPage('preview.upcomingAlert', {
                  date: dateTime.date(document.effectiveFrom, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }),
                })}
              </Alert>
            </div>
          ) : null}
          <DsLayoutInline printFlow="stack" justify="between" align="start">
            <DsLayoutStack gap="xs">
              <DsHeading
                level={1}
                scale="title"
                lang={document.localizationInfo?.displayedLocale || document.localizationInfo?.sourceLocale}
              >
                {document.title}
              </DsHeading>
              <LegalDocumentMetadata
                version={document.version}
                effectiveFrom={document.effectiveFrom}
                effectiveUntil={document.effectiveUntil}
              />
            </DsLayoutStack>
            <PrintButton />
          </DsLayoutInline>
        </DsLayoutStack>
      }
    />
  );
}
