'use client';

import Link from 'next/link';
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
  labels: LegalPolicyHistoryLabels;
  getActive: () => Promise<LegalPolicyHistoryItem | null>;
  listArchived: () => Promise<LegalPolicyHistoryItem[]>;
}

export function LegalPolicyHistoryClient({ policy, labels, getActive, listArchived }: LegalPolicyHistoryClientProps) {
  const dateTime = useDateTimeFormatter();
  const basePath = `/${policy}`;
  const { data: activePolicy, isLoading: isLoadingActive } = useQuery({
    queryKey: [policy, 'active'],
    queryFn: getActive,
  });
  const { data: archivedPolicies, isLoading: isLoadingArchived } = useQuery({
    queryKey: [policy, 'archived', 'list'],
    queryFn: listArchived,
  });

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

  const isLoading = isLoadingActive || isLoadingArchived;
  const hasVersions = Boolean(activePolicy || archivedPolicies?.length);

  return (
    <Stack gap="md">
      <Group>
        <Tooltip label={labels.back}>
          <IconButton component={Link} href={basePath} emphasis="low" aria-label={labels.back}>
            <IconArrowLeft size={20} />
          </IconButton>
        </Tooltip>
        <Title order={2}>{labels.title}</Title>
      </Group>

      {isLoading ? (
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
                href={basePath}
                status={labels.current}
                tone="positive"
                dateRange={formatDateRange(activePolicy.effectiveFrom, null)}
              />
            ) : null}
            {archivedPolicies?.map((item) => (
              <PolicyHistoryRow
                key={item.id}
                item={item}
                href={`${basePath}/history/${item.id}`}
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
    <Table.Tr onClick={() => (window.location.href = href)} style={{ cursor: 'pointer' }}>
      <Table.Td>
        <Text size="sm" fw={500}>
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
