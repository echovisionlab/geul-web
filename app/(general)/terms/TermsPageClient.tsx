'use client';
import { SupportingText, Heading as DsHeading } from '@/components/core/Typography';

import { SectionCard as DsSectionCard } from '@/components/core/Section/SectionCard';
import { LayoutInline as DsLayoutInline, LayoutStack as DsLayoutStack } from '@/components/core/Layout';

import { Suspense } from 'react';

import { useSearchParams } from 'next/navigation';
import { IconCalendar, IconHistory } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';
import { PageLoader } from '@/features/site/PageLoader';
import { LegalDocumentMetadata } from '@/features/policy/LegalDocumentMetadata';
import { LegalTranslationNotice } from '@/features/policy/LegalTranslationNotice';
import { PrintButton } from '@/features/print/PrintButton';
import { LegalDocumentLayout } from '@/features/policy/LegalDocumentLayout';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import { normalizeLocale } from '@/lib/i18n/locale';
import type { PublicLegalPageInitialData } from '@/lib/queries/legal-public-page';
import { CONTENT_LANGUAGE_QUERY_PARAM } from '@/lib/translation/content-language';
import classes from '@/features/policy/LegalDocumentView.module.css';

// The server renders the document; the browser RPC client loads only when a query has to run here
// (token preview, missing or stale server data).
const loadTermsQueries = () => import('@/lib/queries/terms-browser');

interface Props {
  initialData?: PublicLegalPageInitialData;
}

export function TermsPageClient({ initialData }: Props) {
  return (
    <Suspense fallback={<PageLoader />}>
      <TermsContent initialData={initialData} />
    </Suspense>
  );
}

function TermsContent({ initialData }: Props) {
  const searchParams = useSearchParams();
  const previewId = searchParams.get('preview');
  const previewToken = searchParams.get('token');
  const locale = useLocale();
  const requestedLocale = normalizeLocale(searchParams.get(CONTENT_LANGUAGE_QUERY_PARAM)) ?? locale;

  if (previewId && previewToken) {
    return (
      <TermsPreview
        id={previewId}
        token={previewToken}
        requestedLocale={requestedLocale}
        query={Object.fromEntries(searchParams.entries())}
      />
    );
  }

  return (
    <TermsActive
      requestedLocale={requestedLocale}
      query={Object.fromEntries(searchParams.entries())}
      initialData={initialData}
    />
  );
}

function TermsActive({
  requestedLocale,
  query,
  initialData,
}: Props & { requestedLocale: string; query: Record<string, string> }) {
  const t = useTranslations('termsPage.active');
  const tLegalPage = useTranslations('legalPageCommon');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const dateTime = useDateTimeFormatter();
  const tCommonMessages = useTranslations('common.messages');
  const matchingInitialData = initialData?.requestedLocale === requestedLocale ? initialData : undefined;
  const { data, dataUpdatedAt, isLoading, error } = useQuery({
    queryKey: ['terms', 'page', requestedLocale],
    queryFn: async () => (await loadTermsQueries()).getTermsPageData(requestedLocale),
    initialData: matchingInitialData?.data,
    initialDataUpdatedAt: matchingInitialData?.updatedAt,
  });
  // A return visit can already have older data in the browser query cache.
  const pageData =
    matchingInitialData && matchingInitialData.updatedAt > dataUpdatedAt ? matchingInitialData.data : data;
  const activeTerms = pageData?.active;
  const scheduledTerms = pageData?.scheduled;

  if (isLoading && !pageData) {
    return <PageLoader />;
  }

  if (error && !pageData) {
    return <Alert tone="danger">{tCommonMessages('failedToLoad')}</Alert>;
  }

  return (
    <LegalDocumentLayout
      data-legal-document="terms"
      blocks={activeTerms?.content}
      contentLocale={
        activeTerms?.localizationInfo?.displayedLocale || activeTerms?.localizationInfo?.sourceLocale || requestedLocale
      }
      contentClassName={`prose terms-content ${classes.content}`}
      requestedLocale={requestedLocale}
      empty={
        <DsLayoutStack align="center">
          <DsSectionCard padding="xl">
            <DsLayoutStack align="center" gap="md">
              <SupportingText tone="secondary">{t('emptyTitle')}</SupportingText>
              <SupportingText tone="secondary">{t('emptyDescription')}</SupportingText>
            </DsLayoutStack>
          </DsSectionCard>
        </DsLayoutStack>
      }
      header={
        <DsLayoutStack gap="md">
          {/* Header */}
          {activeTerms?.localizationInfo ? (
            <LegalTranslationNotice pathname="/terms" query={query} localizationInfo={activeTerms.localizationInfo} />
          ) : null}
          <DsLayoutInline printFlow="stack" justify="between" align="start">
            <DsLayoutStack gap="xs" flexible>
              <DsHeading level={1} scale="title">
                {tCommonEntities('terms')}
              </DsHeading>
              {activeTerms ? (
                <LegalDocumentMetadata version={activeTerms.version} effectiveFrom={activeTerms.effectiveFrom} />
              ) : null}
            </DsLayoutStack>
            <div className="print-hide">
              <DsLayoutInline gap="xs">
                {activeTerms?.localizationInfo ? (
                  <ContentLanguageMenu
                    pathname="/terms"
                    query={query}
                    requestedLocale={requestedLocale}
                    localizationInfo={activeTerms.localizationInfo}
                  />
                ) : null}
                <PrintButton />
                <Tooltip label={tCommonLabels('versionHistory')}>
                  <IconButton
                    tone="neutral"
                    emphasis="low"
                    href="/terms/history"
                    aria-label={tCommonLabels('versionHistory')}
                  >
                    <IconHistory size={20} />
                  </IconButton>
                </Tooltip>
              </DsLayoutInline>
            </div>
          </DsLayoutInline>

          {scheduledTerms?.effectiveFrom && (
            <div className={classes.notice}>
              <Alert icon={<IconCalendar size={16} />} tone="accent">
                {tLegalPage('active.upcomingAlert', {
                  date: dateTime.date(scheduledTerms.effectiveFrom, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }),
                })}
              </Alert>
            </div>
          )}
        </DsLayoutStack>
      }
    />
  );
}

function TermsPreview({
  id,
  token,
  requestedLocale,
  query,
}: {
  id: string;
  token: string;
  requestedLocale: string;
  query: Record<string, string>;
}) {
  const t = useTranslations('termsPage.preview');
  const tLegalPage = useTranslations('legalPageCommon');
  const tCommonEntities = useTranslations('common.entities');
  const dateTime = useDateTimeFormatter();
  const {
    data: previewTerms,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['terms', 'preview', id, token, requestedLocale],
    queryFn: async () => (await loadTermsQueries()).getScheduledTermsPreview(id, token, requestedLocale),
  });

  if (isLoading) {
    return <PageLoader />;
  }

  if (error || !previewTerms) {
    return (
      <DsLayoutStack gap="md">
        <Alert tone="danger">{tLegalPage('preview.invalid')}</Alert>
        <Button href="/terms" emphasis="medium">
          {t('viewCurrent')}
        </Button>
      </DsLayoutStack>
    );
  }

  return (
    <LegalDocumentLayout
      data-legal-document="terms-preview"
      blocks={previewTerms.content}
      contentLocale={
        previewTerms.localizationInfo?.displayedLocale || previewTerms.localizationInfo?.sourceLocale || requestedLocale
      }
      contentClassName={`prose terms-content ${classes.content}`}
      requestedLocale={requestedLocale}
      empty={
        <DsLayoutStack align="center">
          <DsSectionCard padding="xl">
            <SupportingText tone="secondary">{tLegalPage('preview.empty')}</SupportingText>
          </DsSectionCard>
        </DsLayoutStack>
      }
      header={
        <DsLayoutStack gap="md">
          <div className={classes.notice}>
            <Alert icon={<IconCalendar size={16} />} tone="accent">
              {tLegalPage('preview.upcomingAlert', {
                date: dateTime.date(previewTerms.effectiveFrom!, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }),
              })}
            </Alert>
          </div>

          {/* Header */}
          {previewTerms?.localizationInfo ? (
            <LegalTranslationNotice pathname="/terms" query={query} localizationInfo={previewTerms.localizationInfo} />
          ) : null}
          <DsLayoutInline printFlow="stack" justify="between" align="start">
            <DsLayoutStack gap="xs" flexible>
              <DsHeading level={1} scale="title">
                {tCommonEntities('terms')}
              </DsHeading>
              <LegalDocumentMetadata version={previewTerms.version} effectiveFrom={previewTerms.effectiveFrom} />
            </DsLayoutStack>
            <div className="print-hide">
              <DsLayoutInline gap="xs">
                {previewTerms?.localizationInfo ? (
                  <ContentLanguageMenu
                    pathname="/terms"
                    query={query}
                    requestedLocale={requestedLocale}
                    localizationInfo={previewTerms.localizationInfo}
                  />
                ) : null}
                <PrintButton />
                <Button href="/terms" emphasis="low" size="sm">
                  {t('viewCurrent')}
                </Button>
              </DsLayoutInline>
            </div>
          </DsLayoutInline>
        </DsLayoutStack>
      }
    />
  );
}
