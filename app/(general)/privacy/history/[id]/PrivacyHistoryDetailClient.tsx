'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { IconArrowLeft } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Container, Divider, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { StatusBadge } from '@/components/core/Badge';
import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';
import { PageLoader } from '@/features/site/PageLoader';
import { LegalDocumentMetadata } from '@/features/policy/LegalDocumentMetadata';
import { LegalTranslationNotice } from '@/features/policy/LegalTranslationNotice';
import { PrintButton } from '@/features/print/PrintButton';
import { LegalRichTextContent } from '@/features/policy/LegalRichTextContent';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import { normalizeLocale } from '@/lib/i18n/locale';
import { getArchivedPrivacy } from '@/lib/queries/privacy-browser';
import { CONTENT_LANGUAGE_QUERY_PARAM } from '@/lib/translation/content-language';
import classes from '@/features/policy/LegalDocumentView.module.css';

export function PrivacyHistoryDetailClient({ id }: { id: string }) {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const requestedLocale = normalizeLocale(searchParams?.get(CONTENT_LANGUAGE_QUERY_PARAM)) ?? locale;
  const query = searchParams ? Object.fromEntries(searchParams.entries()) : {};
  const tCommonEntities = useTranslations('common.entities');
  const tCommonStatuses = useTranslations('common.statuses');
  const tLegalHistory = useTranslations('legalHistoryDetailCommon');
  const { data: archived, isLoading } = useQuery({
    queryKey: ['privacy', 'archived', id, requestedLocale],
    queryFn: () => getArchivedPrivacy(id, requestedLocale),
  });

  if (isLoading) {
    return <PageLoader />;
  }

  if (!archived) {
    return (
      <Container size="lg" py="xl" px={{ base: 'md', sm: 'xl' }}>
        <Stack gap="lg">
          <Alert tone="danger">{tLegalHistory('notFound')}</Alert>
          <IconButton
            component={Link}
            href="/privacy/history"
            emphasis="low"
            aria-label={tLegalHistory('backToHistory')}
          >
            <IconArrowLeft size={20} />
          </IconButton>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl" px={{ base: 'md', sm: 'xl' }}>
      <Stack gap="lg" className={classes.document} data-legal-document="privacy-history">
        <LegalTranslationNotice
          pathname={`/privacy/history/${id}`}
          query={query}
          localizationInfo={archived.localizationInfo}
        />
        <Group justify="space-between" align="flex-start" className={classes.header}>
          <Stack gap="xs" style={{ flex: 1 }} className={classes.title}>
            <Group wrap="wrap" gap="xs">
              <Tooltip label={tLegalHistory('backToHistory')}>
                <IconButton
                  component={Link}
                  href="/privacy/history"
                  emphasis="low"
                  aria-label={tLegalHistory('backToHistory')}
                >
                  <IconArrowLeft size={20} />
                </IconButton>
              </Tooltip>
              <Title order={1} style={{ fontWeight: 700, fontSize: '1.5rem' }}>
                {tCommonEntities('privacy')}
              </Title>
              <StatusBadge tone={archived.status === 'active' ? 'positive' : 'neutral'}>
                {tCommonStatuses(archived.status)}
              </StatusBadge>
            </Group>
            <LegalDocumentMetadata
              version={archived.version}
              effectiveFrom={archived.effectiveFrom}
              effectiveUntil={archived.effectiveUntil}
            />
            <Text size="sm" c="dimmed" className="print-hide">
              {tLegalHistory.rich('viewCurrent', {
                link: (chunks) => (
                  <Text component={Link} href="/privacy" c="blue" span>
                    {chunks}
                  </Text>
                ),
              })}
            </Text>
          </Stack>
          <Group gap="xs" className="print-hide">
            {archived.localizationInfo ? (
              <ContentLanguageMenu
                pathname={`/privacy/history/${id}`}
                query={query}
                requestedLocale={requestedLocale}
                localizationInfo={archived.localizationInfo}
              />
            ) : null}
            <PrintButton />
          </Group>
        </Group>

        <Divider />

        {archived.content ? (
          <LegalRichTextContent
            blocks={archived.content}
            className={`prose privacy-history-content ${classes.content}`}
          />
        ) : (
          <Paper p="xl" withBorder ta="center">
            <Text c="dimmed">{tLegalHistory('empty')}</Text>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
