'use client';
import { Heading as DsHeading, Text as DsText } from '@/components/core/Typography';

import { SectionCard as DsSectionCard } from '@/components/core/Section';
import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import Link from '@/components/core/Navigation';
import type { PublicLegalHistoryInitialData } from '@/lib/queries/legal-history';
import { buildContentLanguageHref, readContentLocaleOverride } from '@/lib/translation/content-language';
import { useSearchParams } from 'next/navigation';
import { IconArrowLeft, IconFileText } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import { Table } from '@/components/core/Display';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';
import { PageLoader } from '@/features/site/PageLoader';
import { EmptyState } from '@/components/core/EmptyState';

export interface LegalPolicyHistoryItem {
  id: string;
  version: number;
  effectiveFrom: Date | null;
  effectiveUntil?: Date | null;
}

interface LegalPolicyHistoryLabels {
  title: string;
  back: string;
  noVersions: string;
  version: string;
  status: string;
  current: string;
  archived: string;
  effectivePeriod: string;
  notAvailable: string;
  openDateRange: (from: string) => string;
  closedDateRange: (from: string, until: string) => string;
}

interface LegalPolicyHistoryClientProps {
  policy: 'privacy' | 'terms';
  requestedLocale?: string;
  initialData?: PublicLegalHistoryInitialData;
  labels: LegalPolicyHistoryLabels;
  getActive: (requestedLocale?: string) => Promise<LegalPolicyHistoryItem | null>;
  listArchived: (requestedLocale?: string) => Promise<LegalPolicyHistoryItem[]>;
}

export function LegalPolicyHistoryClient({
  policy,
  labels,
  getActive,
  listArchived,
  requestedLocale,
  initialData,
}: LegalPolicyHistoryClientProps) {
  const dateTime = useDateTimeFormatter();
  const basePath = `/${policy}`;
  const matchingInitialData = initialData?.requestedLocale === requestedLocale ? initialData : undefined;
  // Links keep only a language the reader chose in the URL; otherwise they follow the site language.
  const explicitLocale = readContentLocaleOverride(Object.fromEntries(useSearchParams().entries()));
  const href = (path: string) => buildContentLanguageHref(path, undefined, { requestedLocale: explicitLocale });
  const queriedActiveQuery = useQuery({
    queryKey: [policy, 'active', requestedLocale],
    queryFn: () => getActive(requestedLocale),
    initialData: matchingInitialData?.active,
    initialDataUpdatedAt: matchingInitialData?.updatedAt,
  });
  const { data: queriedActive, dataUpdatedAt: activeUpdatedAt, isLoading: isLoadingActive } = queriedActiveQuery;
  const queriedArchivedQuery = useQuery({
    queryKey: [policy, 'archived', 'list', requestedLocale],
    queryFn: () => listArchived(requestedLocale),
    initialData: matchingInitialData?.archived,
    initialDataUpdatedAt: matchingInitialData?.updatedAt,
  });
  const {
    data: queriedArchived,
    dataUpdatedAt: archivedUpdatedAt,
    isLoading: isLoadingArchived,
  } = queriedArchivedQuery;

  const activePolicy =
    matchingInitialData && matchingInitialData.updatedAt > activeUpdatedAt ? matchingInitialData.active : queriedActive;
  const archivedPolicies =
    matchingInitialData && matchingInitialData.updatedAt > archivedUpdatedAt
      ? matchingInitialData.archived
      : queriedArchived;

  const formatDateRange = (effectiveFrom: Date | null, effectiveUntil: Date | null) => {
    if (!effectiveFrom) {
      return labels.notAvailable;
    }

    const from = dateTime.date(effectiveFrom, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    if (!effectiveUntil) {
      return labels.openDateRange(from);
    }

    const until = dateTime.date(effectiveUntil, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    return labels.closedDateRange(from, until);
  };

  const isLoading = !matchingInitialData && (isLoadingActive || isLoadingArchived);
  const hasVersions = Boolean(activePolicy || archivedPolicies?.length);

  return (
    <DsLayoutStack gap="md">
      <QueryErrorAlert queries={[queriedActiveQuery, queriedArchivedQuery]} />
      <DsLayoutInline>
        <Tooltip label={labels.back}>
          <IconButton href={href(basePath)} emphasis="low" aria-label={labels.back}>
            <IconArrowLeft size={20} />
          </IconButton>
        </Tooltip>
        <DsHeading level={1} scale={2}>
          {labels.title}
        </DsHeading>
      </DsLayoutInline>

      {queriedActiveQuery.isError || queriedArchivedQuery.isError ? null : isLoading ? (
        <PageLoader placement="flow" />
      ) : !hasVersions ? (
        <DsSectionCard withBorder padding="xl">
          <EmptyState inset="none" icon={IconFileText} title={labels.noVersions} />
        </DsSectionCard>
      ) : (
        <Table.ScrollContainer minWidth={480} role="region" aria-label={labels.title} tabIndex={0}>
          <Table highlightOnHover aria-label={labels.title}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">{labels.version}</Table.Th>
                <Table.Th scope="col">{labels.status}</Table.Th>
                <Table.Th scope="col">{labels.effectivePeriod}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {activePolicy ? (
                <PolicyHistoryRow
                  item={activePolicy}
                  href={href(basePath)}
                  status={labels.current}
                  dateRange={formatDateRange(activePolicy.effectiveFrom, null)}
                />
              ) : null}
              {archivedPolicies?.map((item) => (
                <PolicyHistoryRow
                  key={item.id}
                  item={item}
                  href={href(`${basePath}/history/${item.id}`)}
                  status={labels.archived}
                  dateRange={formatDateRange(item.effectiveFrom, item.effectiveUntil ?? null)}
                />
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </DsLayoutStack>
  );
}

function PolicyHistoryRow({
  item,
  href,
  status,
  dateRange,
}: {
  item: LegalPolicyHistoryItem;
  href: string;
  status: string;
  dateRange: string;
}) {
  return (
    <Table.Tr>
      <Table.Td>
        <Link appearance="quiet" href={href}>
          v{item.version}
        </Link>
      </Table.Td>
      <Table.Td>
        <DsText size="sm">{status}</DsText>
      </Table.Td>
      <Table.Td>
        <DsText size="sm" tone="secondary">
          {dateRange}
        </DsText>
      </Table.Td>
    </Table.Tr>
  );
}
