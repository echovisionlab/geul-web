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
const loadPrivacyQueries = () => import('@/lib/queries/privacy-browser');

interface Props {
  initialData?: PublicLegalPageInitialData;
}

export function PrivacyPageClient({ initialData }: Props) {
  return (
    <Suspense fallback={<PageLoader />}>
      <PrivacyContent initialData={initialData} />
    </Suspense>
  );
}

function PrivacyContent({ initialData }: Props) {
  const searchParams = useSearchParams();
  const previewId = searchParams.get('preview');
  const previewToken = searchParams.get('token');
  const locale = useLocale();
  const requestedLocale = normalizeLocale(searchParams.get(CONTENT_LANGUAGE_QUERY_PARAM)) ?? locale;

  if (previewId && previewToken) {
    return (
      <PrivacyPreview
        id={previewId}
        token={previewToken}
        requestedLocale={requestedLocale}
        query={Object.fromEntries(searchParams.entries())}
      />
    );
  }

  return (
    <PrivacyActive
      requestedLocale={requestedLocale}
      query={Object.fromEntries(searchParams.entries())}
      initialData={initialData}
    />
  );
}

function PrivacyActive({
  requestedLocale,
  query,
  initialData,
}: Props & { requestedLocale: string; query: Record<string, string> }) {
  const t = useTranslations('privacyPage.active');
  const tLegalPage = useTranslations('legalPageCommon');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const dateTime = useDateTimeFormatter();
  const tCommonMessages = useTranslations('common.messages');
  const matchingInitialData = initialData?.requestedLocale === requestedLocale ? initialData : undefined;
  const { data, dataUpdatedAt, isLoading, error } = useQuery({
    queryKey: ['privacy', 'page', requestedLocale],
    queryFn: async () => (await loadPrivacyQueries()).getPrivacyPageData(requestedLocale),
    initialData: matchingInitialData?.data,
    initialDataUpdatedAt: matchingInitialData?.updatedAt,
  });
  // A return visit can already have older data in the browser query cache.
  const pageData =
    matchingInitialData && matchingInitialData.updatedAt > dataUpdatedAt ? matchingInitialData.data : data;
  const activePrivacy = pageData?.active;
  const scheduledPrivacy = pageData?.scheduled;

  if (isLoading && !pageData) {
    return <PageLoader />;
  }

  if (error && !pageData) {
    return <Alert tone="danger">{tCommonMessages('failedToLoad')}</Alert>;
  }

  return (
    <LegalDocumentLayout
      data-legal-document="privacy"
      blocks={activePrivacy?.content}
      contentLocale={
        activePrivacy?.localizationInfo?.displayedLocale ||
        activePrivacy?.localizationInfo?.sourceLocale ||
        requestedLocale
      }
      contentClassName={`prose privacy-content ${classes.content}`}
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
          {activePrivacy?.localizationInfo ? (
            <LegalTranslationNotice
              pathname="/privacy"
              query={query}
              localizationInfo={activePrivacy.localizationInfo}
            />
          ) : null}
          <DsLayoutInline printFlow="stack" justify="between" align="start">
            <DsLayoutStack gap="xs" flexible>
              <DsHeading level={1} scale="title">
                {tCommonEntities('privacy')}
              </DsHeading>
              {activePrivacy ? (
                <LegalDocumentMetadata version={activePrivacy.version} effectiveFrom={activePrivacy.effectiveFrom} />
              ) : null}
            </DsLayoutStack>
            <div className="print-hide">
              <DsLayoutInline gap="xs">
                {activePrivacy?.localizationInfo ? (
                  <ContentLanguageMenu
                    pathname="/privacy"
                    query={query}
                    requestedLocale={requestedLocale}
                    localizationInfo={activePrivacy.localizationInfo}
                  />
                ) : null}
                <PrintButton />
                <Tooltip label={tCommonLabels('versionHistory')}>
                  <IconButton
                    tone="neutral"
                    emphasis="low"
                    href="/privacy/history"
                    aria-label={tCommonLabels('versionHistory')}
                  >
                    <IconHistory size={20} />
                  </IconButton>
                </Tooltip>
              </DsLayoutInline>
            </div>
          </DsLayoutInline>

          {scheduledPrivacy?.effectiveFrom && (
            <div className={classes.notice}>
              <Alert icon={<IconCalendar size={16} />} tone="accent">
                {tLegalPage('active.upcomingAlert', {
                  date: dateTime.date(scheduledPrivacy.effectiveFrom, {
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

function PrivacyPreview({
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
  const t = useTranslations('privacyPage.preview');
  const tLegalPage = useTranslations('legalPageCommon');
  const tCommonEntities = useTranslations('common.entities');
  const dateTime = useDateTimeFormatter();
  const {
    data: previewPrivacy,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['privacy', 'preview', id, token, requestedLocale],
    queryFn: async () => (await loadPrivacyQueries()).getScheduledPrivacyPreview(id, token, requestedLocale),
  });

  if (isLoading) {
    return <PageLoader />;
  }

  if (error || !previewPrivacy) {
    return (
      <DsLayoutStack gap="md">
        <Alert tone="danger">{tLegalPage('preview.invalid')}</Alert>
        <Button href="/privacy" emphasis="medium">
          {t('viewCurrent')}
        </Button>
      </DsLayoutStack>
    );
  }

  return (
    <LegalDocumentLayout
      data-legal-document="privacy-preview"
      blocks={previewPrivacy.content}
      contentLocale={
        previewPrivacy.localizationInfo?.displayedLocale ||
        previewPrivacy.localizationInfo?.sourceLocale ||
        requestedLocale
      }
      contentClassName={`prose privacy-content ${classes.content}`}
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
                date: dateTime.date(previewPrivacy.effectiveFrom!, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }),
              })}
            </Alert>
          </div>

          {/* Header */}
          {previewPrivacy?.localizationInfo ? (
            <LegalTranslationNotice
              pathname="/privacy"
              query={query}
              localizationInfo={previewPrivacy.localizationInfo}
            />
          ) : null}
          <DsLayoutInline printFlow="stack" justify="between" align="start">
            <DsLayoutStack gap="xs" flexible>
              <DsHeading level={1} scale="title">
                {tCommonEntities('privacy')}
              </DsHeading>
              <LegalDocumentMetadata version={previewPrivacy.version} effectiveFrom={previewPrivacy.effectiveFrom} />
            </DsLayoutStack>
            <div className="print-hide">
              <DsLayoutInline gap="xs">
                {previewPrivacy?.localizationInfo ? (
                  <ContentLanguageMenu
                    pathname="/privacy"
                    query={query}
                    requestedLocale={requestedLocale}
                    localizationInfo={previewPrivacy.localizationInfo}
                  />
                ) : null}
                <PrintButton />
                <Button href="/privacy" emphasis="low" size="sm">
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
