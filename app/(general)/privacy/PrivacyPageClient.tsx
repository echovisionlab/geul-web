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
import { getActivePrivacy, getScheduledPrivacy, getScheduledPrivacyPreview } from '@/lib/queries/privacy-browser';
import { CONTENT_LANGUAGE_QUERY_PARAM } from '@/lib/translation/content-language';
import classes from '@/features/policy/LegalDocumentView.module.css';

export function PrivacyPageClient() {
  return (
    <Suspense fallback={<PageLoader />}>
      <PrivacyContent />
    </Suspense>
  );
}

function PrivacyContent() {
  const searchParams = useSearchParams();
  const previewId = searchParams.get('preview');
  const previewToken = searchParams.get('token');
  const locale = useLocale();
  const requestedLocale = normalizeLocale(searchParams.get(CONTENT_LANGUAGE_QUERY_PARAM)) ?? locale;

  // If preview mode
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

  return <PrivacyActive requestedLocale={requestedLocale} query={Object.fromEntries(searchParams.entries())} />;
}

function PrivacyActive({ requestedLocale, query }: { requestedLocale: string; query: Record<string, string> }) {
  const t = useTranslations('privacyPage.active');
  const tLegalPage = useTranslations('legalPageCommon');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const dateTime = useDateTimeFormatter();
  const { data: activePrivacy, isLoading } = useQuery({
    queryKey: ['privacy', 'active', requestedLocale],
    queryFn: () => getActivePrivacy(requestedLocale),
  });
  const { data: scheduledPrivacy } = useQuery({
    queryKey: ['privacy', 'scheduled', requestedLocale],
    queryFn: () => getScheduledPrivacy(requestedLocale),
  });

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <Stack gap="md" className={classes.document} data-legal-document="privacy">
      {/* Header */}
      {activePrivacy?.localizationInfo ? (
        <LegalTranslationNotice pathname="/privacy" query={query} localizationInfo={activePrivacy.localizationInfo} />
      ) : null}
      <Group justify="space-between" align="flex-start" className={classes.header}>
        <Stack gap="xs" style={{ flex: 1 }} className={classes.title}>
          <Title order={1} style={{ fontWeight: 700, fontSize: '1.5rem' }}>
            {tCommonEntities('privacy')}
          </Title>
          {activePrivacy ? (
            <LegalDocumentMetadata version={activePrivacy.version} effectiveFrom={activePrivacy.effectiveFrom} />
          ) : null}
        </Stack>
        <Group gap="xs" className="print-hide">
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
              component={Link}
              href="/privacy/history"
              aria-label={tCommonLabels('versionHistory')}
            >
              <IconHistory size={20} />
            </IconButton>
          </Tooltip>
        </Group>
      </Group>

      {scheduledPrivacy && (
        <Alert icon={<IconCalendar size={16} />} tone="accent" className={classes.notice}>
          {tLegalPage('active.upcomingAlert', {
            date: dateTime.date(scheduledPrivacy.effectiveFrom!, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
          })}
        </Alert>
      )}

      {activePrivacy?.content ? (
        <LegalRichTextContent
          blocks={activePrivacy.content}
          className={`prose privacy-content ${classes.content}`}
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
    queryFn: () => getScheduledPrivacyPreview(id, token, requestedLocale),
  });

  if (isLoading) {
    return <PageLoader />;
  }

  if (error || !previewPrivacy) {
    return (
      <Stack gap="md">
        <Alert tone="danger">{tLegalPage('preview.invalid')}</Alert>
        <Button component={Link} href="/privacy" emphasis="medium" w="fit-content">
          {t('viewCurrent')}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="md" className={classes.document} data-legal-document="privacy-preview">
      <Alert icon={<IconCalendar size={16} />} tone="accent" className={classes.notice}>
        {tLegalPage('preview.upcomingAlert', {
          date: dateTime.date(previewPrivacy.effectiveFrom!, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        })}
      </Alert>

      {/* Header */}
      {previewPrivacy?.localizationInfo ? (
        <LegalTranslationNotice pathname="/privacy" query={query} localizationInfo={previewPrivacy.localizationInfo} />
      ) : null}
      <Group justify="space-between" align="flex-start" className={classes.header}>
        <Stack gap="xs" style={{ flex: 1 }} className={classes.title}>
          <Title order={1} style={{ fontWeight: 700, fontSize: '1.5rem' }}>
            {tCommonEntities('privacy')}
          </Title>
          <LegalDocumentMetadata version={previewPrivacy.version} effectiveFrom={previewPrivacy.effectiveFrom} />
        </Stack>
        <Group gap="xs" className="print-hide">
          {previewPrivacy?.localizationInfo ? (
            <ContentLanguageMenu
              pathname="/privacy"
              query={query}
              requestedLocale={requestedLocale}
              localizationInfo={previewPrivacy.localizationInfo}
            />
          ) : null}
          <PrintButton />
          <Button component={Link} href="/privacy" emphasis="low" size="sm">
            {t('viewCurrent')}
          </Button>
        </Group>
      </Group>

      {previewPrivacy.content ? (
        <LegalRichTextContent
          blocks={previewPrivacy.content}
          className={`prose privacy-content ${classes.content}`}
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
