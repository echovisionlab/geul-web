'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { IconCalendar, IconHistory } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Group, Paper, Stack, Text, Title } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';
import { PageLoader } from '@/features/site/PageLoader';
import { LegalDocumentMetadata } from '@/features/policy/LegalDocumentMetadata';
import { LegalTranslationNotice } from '@/features/policy/LegalTranslationNotice';
import { PrintButton } from '@/features/print/PrintButton';
import { LegalRichTextContent } from '@/features/policy/LegalRichTextContent';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import { normalizeLocale } from '@/lib/i18n/locale';
import { getTermsPageData, getScheduledTermsPreview } from '@/lib/queries/terms-browser';
import type { PublicLegalPageInitialData } from '@/lib/queries/legal-public-page';
import { CONTENT_LANGUAGE_QUERY_PARAM } from '@/lib/translation/content-language';
import classes from '@/features/policy/LegalDocumentView.module.css';

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
    queryFn: () => getTermsPageData(requestedLocale),
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
    <Stack gap="md" className={classes.document} data-legal-document="terms">
      {/* Header */}
      {activeTerms?.localizationInfo ? (
        <LegalTranslationNotice pathname="/terms" query={query} localizationInfo={activeTerms.localizationInfo} />
      ) : null}
      <Group justify="space-between" align="flex-start" className={classes.header}>
        <Stack gap="xs" style={{ flex: 1 }} className={classes.title}>
          <Title order={1} style={{ fontWeight: 700, fontSize: '1.5rem' }}>
            {tCommonEntities('terms')}
          </Title>
          {activeTerms ? (
            <LegalDocumentMetadata version={activeTerms.version} effectiveFrom={activeTerms.effectiveFrom} />
          ) : null}
        </Stack>
        <Group gap="xs" className="print-hide">
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
              component={Link}
              href="/terms/history"
              aria-label={tCommonLabels('versionHistory')}
            >
              <IconHistory size={20} />
            </IconButton>
          </Tooltip>
        </Group>
      </Group>

      {scheduledTerms?.effectiveFrom && (
        <Alert icon={<IconCalendar size={16} />} tone="accent" className={classes.notice}>
          {tLegalPage('active.upcomingAlert', {
            date: dateTime.date(scheduledTerms.effectiveFrom, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
          })}
        </Alert>
      )}

      {activeTerms?.content ? (
        <LegalRichTextContent
          blocks={activeTerms.content}
          className={`prose terms-content ${classes.content}`}
          requestedLocale={requestedLocale}
        />
      ) : (
        <Paper p="xl" withBorder ta="center">
          <Stack align="center" gap="md">
            <Text c="dimmed">{t('emptyTitle')}</Text>
            <Text size="sm" c="dimmed">
              {t('emptyDescription')}
            </Text>
          </Stack>
        </Paper>
      )}
    </Stack>
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
    queryFn: () => getScheduledTermsPreview(id, token, requestedLocale),
  });

  if (isLoading) {
    return <PageLoader />;
  }

  if (error || !previewTerms) {
    return (
      <Stack gap="md">
        <Alert tone="danger">{tLegalPage('preview.invalid')}</Alert>
        <Button component={Link} href="/terms" emphasis="medium" w="fit-content">
          {t('viewCurrent')}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="md" className={classes.document} data-legal-document="terms-preview">
      <Alert icon={<IconCalendar size={16} />} tone="accent" className={classes.notice}>
        {tLegalPage('preview.upcomingAlert', {
          date: dateTime.date(previewTerms.effectiveFrom!, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        })}
      </Alert>

      {/* Header */}
      {previewTerms?.localizationInfo ? (
        <LegalTranslationNotice pathname="/terms" query={query} localizationInfo={previewTerms.localizationInfo} />
      ) : null}
      <Group justify="space-between" align="flex-start" className={classes.header}>
        <Stack gap="xs" style={{ flex: 1 }} className={classes.title}>
          <Title order={1} style={{ fontWeight: 700, fontSize: '1.5rem' }}>
            {tCommonEntities('terms')}
          </Title>
          <LegalDocumentMetadata version={previewTerms.version} effectiveFrom={previewTerms.effectiveFrom} />
        </Stack>
        <Group gap="xs" className="print-hide">
          {previewTerms?.localizationInfo ? (
            <ContentLanguageMenu
              pathname="/terms"
              query={query}
              requestedLocale={requestedLocale}
              localizationInfo={previewTerms.localizationInfo}
            />
          ) : null}
          <PrintButton />
          <Button component={Link} href="/terms" emphasis="low" size="sm">
            {t('viewCurrent')}
          </Button>
        </Group>
      </Group>

      {previewTerms.content ? (
        <LegalRichTextContent
          blocks={previewTerms.content}
          className={`prose terms-content ${classes.content}`}
          requestedLocale={requestedLocale}
        />
      ) : (
        <Paper p="xl" withBorder ta="center">
          <Text c="dimmed">{tLegalPage('preview.empty')}</Text>
        </Paper>
      )}
    </Stack>
  );
}
