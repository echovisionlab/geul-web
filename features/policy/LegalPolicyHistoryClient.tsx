'use client';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import Link from '@/components/core/Navigation';
import type { PublicLegalHistoryInitialData } from '@/lib/queries/legal-history';
import { buildContentLanguageHref } from '@/lib/translation/content-language';
import { IconArrowLeft, IconFileText } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Group, Paper, Stack, Table, Text, Title } from '@mantine/core';
import { StatusBadge } from '@/components/core/Badge';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';
import { PageLoader } from '@/features/site/PageLoader';

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
  listArchived: () => Promise<LegalPolicyHistoryItem[]>;
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
  const href = (path: string) => buildContentLanguageHref(path, undefined, { requestedLocale });
  const queriedActiveQuery = useQuery({
    queryKey: [policy, 'active', requestedLocale],
    queryFn: () => getActive(requestedLocale),
    initialData: matchingInitialData?.active,
    initialDataUpdatedAt: matchingInitialData?.updatedAt,
  });
  const { data: queriedActive, dataUpdatedAt: activeUpdatedAt, isLoading: isLoadingActive } = queriedActiveQuery;
  const queriedArchivedQuery = useQuery({
    queryKey: [policy, 'archived', 'list'],
    queryFn: listArchived,
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
    <Stack gap="md">
      <QueryErrorAlert queries={[queriedActiveQuery, queriedArchivedQuery]} />
      <Group>
        <Tooltip label={labels.back}>
          <IconButton component={Link} href={href(basePath)} emphasis="low" aria-label={labels.back}>
            <IconArrowLeft size={20} />
          </IconButton>
        </Tooltip>
        <Title order={2}>{labels.title}</Title>
      </Group>

      {queriedActiveQuery.isError || queriedArchivedQuery.isError ? null : isLoading ? (
        <PageLoader />
      ) : !hasVersions ? (
        <Paper p="xl" withBorder ta="center">
          <Stack align="center" gap="md">
            <IconFileText size={48} opacity={0.3} />
            <Text c="dimmed">{labels.noVersions}</Text>
          </Stack>
        </Paper>
      ) : (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{labels.version}</Table.Th>
              <Table.Th>{labels.status}</Table.Th>
              <Table.Th>{labels.effectivePeriod}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {activePolicy ? (
              <PolicyHistoryRow
                item={activePolicy}
                href={href(basePath)}
                status={labels.current}
                tone="positive"
                dateRange={formatDateRange(activePolicy.effectiveFrom, null)}
              />
            ) : null}
            {archivedPolicies?.map((item) => (
              <PolicyHistoryRow
                key={item.id}
                item={item}
                href={href(`${basePath}/history/${item.id}`)}
                status={labels.archived}
                tone="neutral"
                dateRange={formatDateRange(item.effectiveFrom, item.effectiveUntil ?? null)}
              />
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

function PolicyHistoryRow({
  item,
  href,
  status,
  tone,
  dateRange,
}: {
  item: LegalPolicyHistoryItem;
  href: string;
  status: string;
  tone: 'positive' | 'neutral';
  dateRange: string;
}) {
  return (
    <Table.Tr>
      <Table.Td>
        <Text component={Link} href={href} size="sm" fw={500}>
          v{item.version}
        </Text>
      </Table.Td>
      <Table.Td>
        <StatusBadge tone={tone} size="sm">
          {status}
        </StatusBadge>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">
          {dateRange}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}
