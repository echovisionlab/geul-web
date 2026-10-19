'use client';
import { SupportingText, Heading as DsHeading, Text as DsText } from '@/components/core/Typography';

import { SectionCard as DsSectionCard } from '@/components/core/Section/SectionCard';

import {
  LayoutContainer as DsLayoutContainer,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
} from '@/components/core/Layout';

import Link from '@/components/core/Navigation';
import type { PublicLegalHistoryDetailInitialData } from '@/lib/queries/legal-history';
import { useSearchParams } from 'next/navigation';
import { IconArrowLeft } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

import { Alert } from '@/components/core/Alert';
import { StatusBadge } from '@/components/core/Badge';
import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';
import { PageLoader } from '@/features/site/PageLoader';
import { LegalDocumentMetadata } from '@/features/policy/LegalDocumentMetadata';
import { ContentLocaleNotice } from '@/features/translation/ContentLocaleNotice';
import { PrintButton } from '@/features/print/PrintButton';
import { LegalDocumentLayout } from '@/features/policy/LegalDocumentLayout';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import { normalizeLocale } from '@/lib/i18n/locale';
import { CONTENT_LANGUAGE_QUERY_PARAM } from '@/lib/translation/content-language';
import classes from '@/features/policy/LegalDocumentView.module.css';

// The server renders the document; the browser RPC client loads only when a query has to run here
// (token preview, missing or stale server data).
const loadTermsQueries = () => import('@/lib/queries/terms-browser');

export function TermsHistoryDetailClient({
  id,
  initialData,
}: {
  id: string;
  initialData?: PublicLegalHistoryDetailInitialData;
}) {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const requestedLocale = normalizeLocale(searchParams?.get(CONTENT_LANGUAGE_QUERY_PARAM)) ?? locale;
  const query = searchParams ? Object.fromEntries(searchParams.entries()) : {};
  const tCommonEntities = useTranslations('common.entities');
  const tCommonStatuses = useTranslations('common.statuses');
  const tLegalHistory = useTranslations('legalHistoryDetailCommon');
  const matchingInitialData =
    initialData?.id === id && initialData.requestedLocale === requestedLocale ? initialData : undefined;
  const { data, dataUpdatedAt, isLoading } = useQuery({
    queryKey: ['terms', 'archived', id, requestedLocale],
    queryFn: async () => (await loadTermsQueries()).getArchivedTerms(id, requestedLocale),
    initialData: matchingInitialData?.data,
    initialDataUpdatedAt: matchingInitialData?.updatedAt,
  });

  const archived =
    matchingInitialData && matchingInitialData.updatedAt > dataUpdatedAt ? matchingInitialData.data : data;

  if (isLoading && !matchingInitialData) {
    return <PageLoader />;
  }

  if (!archived) {
    return (
      <DsLayoutInset block="xl" inline={{ base: 'md', sm: 'xl' }}>
        <DsLayoutContainer size="wide">
          <DsLayoutStack gap="lg">
            <Alert tone="danger">{tLegalHistory('notFound')}</Alert>
            <IconButton href="/terms/history" emphasis="low" aria-label={tLegalHistory('backToHistory')}>
              <IconArrowLeft size={20} />
            </IconButton>
          </DsLayoutStack>
        </DsLayoutContainer>
      </DsLayoutInset>
    );
  }

  return (
    <DsLayoutInset block="xl" inline={{ base: 'md', sm: 'xl' }}>
      <DsLayoutContainer size="wide">
        <LegalDocumentLayout
          data-legal-document="terms-history"
          blocks={archived.content}
          contentLocale={
            archived.localizationInfo?.displayedLocale || archived.localizationInfo?.sourceLocale || requestedLocale
          }
          contentClassName={`prose terms-history-content ${classes.content}`}
          requestedLocale={requestedLocale}
          empty={
            <DsLayoutStack align="center">
              <DsSectionCard padding="xl">
                <SupportingText tone="secondary">{tLegalHistory('empty')}</SupportingText>
              </DsSectionCard>
            </DsLayoutStack>
          }
          header={
            <DsLayoutStack gap="lg">
              <ContentLocaleNotice
                announceTranslation
                pathname={`/terms/history/${id}`}
                query={query}
                localizationInfo={archived.localizationInfo}
              />
              <DsLayoutInline printFlow="stack" justify="between" align="start">
                <DsLayoutStack gap="xs" flexible>
                  <DsLayoutInline wrap="wrap" gap="xs">
                    <Tooltip label={tLegalHistory('backToHistory')}>
                      <IconButton href="/terms/history" emphasis="low" aria-label={tLegalHistory('backToHistory')}>
                        <IconArrowLeft size={20} />
                      </IconButton>
                    </Tooltip>
                    <DsHeading
                      level={1}
                      scale="title"
                      lang={
                        archived.title
                          ? archived.localizationInfo?.displayedLocale ||
                            archived.localizationInfo?.sourceLocale ||
                            requestedLocale
                          : undefined
                      }
                      dir="auto"
                    >
                      {archived.title || tCommonEntities('terms')}
                    </DsHeading>
                    <StatusBadge tone={archived.status === 'active' ? 'positive' : 'neutral'}>
                      {tCommonStatuses(archived.status)}
                    </StatusBadge>
                  </DsLayoutInline>
                  <LegalDocumentMetadata
                    version={archived.version}
                    effectiveFrom={archived.effectiveFrom}
                    effectiveUntil={archived.effectiveUntil}
                  />
                  <div className="print-hide">
                    <DsText size="sm" tone="secondary">
                      {tLegalHistory.rich('viewCurrent', {
                        link: (chunks) => <Link href="/terms">{chunks}</Link>,
                      })}
                    </DsText>
                  </div>
                </DsLayoutStack>
                <div className="print-hide">
                  <DsLayoutInline gap="xs">
                    {archived.localizationInfo ? (
                      <ContentLanguageMenu
                        pathname={`/terms/history/${id}`}
                        query={query}
                        requestedLocale={requestedLocale}
                        localizationInfo={archived.localizationInfo}
                      />
                    ) : null}
                    <PrintButton />
                  </DsLayoutInline>
                </div>
              </DsLayoutInline>
            </DsLayoutStack>
          }
        />
      </DsLayoutContainer>
    </DsLayoutInset>
  );
}
