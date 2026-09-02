'use client';

import { Box, Group, Stack, Text } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { TextButton } from '@/components/core/TextButton';
import { DataTable } from '@/features/data-table/DataTable';
import type { FilterFieldConfig } from '@/features/data-table/DataTableMultiFilter';
import type { BrowserProgramEventLocationMode } from '@/lib/queries/program-event-browser';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQuery } from '@/lib/types/common/query';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';
import { formatDateTimeInZone } from '@/components/core/DateTime';
import { useRequestTimeZone } from '@/lib/providers/RequestTimeZoneProvider';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';

export type EventSeriesEventsFilterField = 'type_id' | 'location_mode';
export type EventSeriesEventsQuery = PaginatedQuery<string, EventSeriesEventsFilterField>;

export interface EventSeriesEventsTableItem {
  id: string;
  href: string;
  title: string;
  summary: string | null;
  typeName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  allDay: boolean;
  locationMode: BrowserProgramEventLocationMode;
  posterUrl: string | null;
  publishedAt: string | null;
}

export interface EventSeriesEventsTableViewLabels {
  date: string;
  event: string;
  type: string;
  location: string;
  tba: string;
  empty: string;
  searchPlaceholder: string;
  showMore: (count: number) => string;
}

interface EventSeriesEventsTableViewProps {
  result: PaginatedQueryResult<EventSeriesEventsTableItem>;
  loading: boolean;
  query: EventSeriesEventsQuery;
  pageSize: number;
  locale: string;
  labels: EventSeriesEventsTableViewLabels;
  locationLabels: Record<BrowserProgramEventLocationMode, string>;
  filterFields: FilterFieldConfig[];
  isLoadingMore: boolean;
  error?: string | null;
  onQueryChange: (query: PaginatedQuery) => void;
  onLoadMore: () => void;
}

function formatEventDate(
  event: EventSeriesEventsTableItem,
  locale: string,
  requestTimeZone: string,
  tbaLabel: string,
): string {
  if (!event.startsAt) {
    return tbaLabel;
  }

  const timeZone = event.timezone || requestTimeZone;
  if (event.allDay) {
    return formatDateTimeInZone(event.startsAt, locale, timeZone, 'date', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  }

  const formatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  const formattedStart = formatDateTimeInZone(event.startsAt, locale, timeZone, 'dateTime', formatOptions);
  if (!event.endsAt) {
    return formattedStart;
  }

  const formattedEnd = formatDateTimeInZone(event.endsAt, locale, timeZone, 'dateTime', formatOptions);
  return `${formattedStart} - ${formattedEnd}`;
}

function buildColumns(
  locale: string,
  requestTimeZone: string,
  labels: Pick<EventSeriesEventsTableViewLabels, 'date' | 'event' | 'type' | 'location' | 'tba'>,
  locationLabels: Record<BrowserProgramEventLocationMode, string>,
): ColumnDef<EventSeriesEventsTableItem>[] {
  return [
    {
      key: 'poster',
      header: '',
      width: 72,
      cell: (event) => (
        <Box
          style={{
            width: 48,
            height: 64,
            overflow: 'hidden',
            background: 'var(--mantine-color-dark-6)',
          }}
        >
          {event.posterUrl ? (
            <img
              src={buildManagedImageUrl(event.posterUrl, MANAGED_IMAGE_PRESET.POSTER_THUMB) ?? event.posterUrl}
              alt={event.title}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : null}
        </Box>
      ),
    },
    {
      key: 'title',
      header: labels.event,
      cell: (event) => (
        <Stack gap={2}>
          <TextButton href={event.href} size="sm" appearance="default">
            {event.title}
          </TextButton>
          {event.summary ? (
            <Text size="sm" c="dimmed" lineClamp={2}>
              {event.summary}
            </Text>
          ) : null}
        </Stack>
      ),
    },
    {
      key: 'startsAt',
      header: labels.date,
      width: 180,
      cell: (event) => (
        <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
          {formatEventDate(event, locale, requestTimeZone, labels.tba)}
        </Text>
      ),
    },
    {
      key: 'typeName',
      header: labels.type,
      width: 160,
      cell: (event) => (
        <Text size="sm" c={event.typeName ? undefined : 'dimmed'}>
          {event.typeName || '-'}
        </Text>
      ),
    },
    {
      key: 'locationMode',
      header: labels.location,
      width: 140,
      cell: (event) => (
        <Text size="sm" c="dimmed">
          {locationLabels[event.locationMode]}
        </Text>
      ),
    },
  ];
}

export function EventSeriesEventsTableView({
  result,
  loading,
  query,
  pageSize,
  locale,
  labels,
  locationLabels,
  filterFields,
  isLoadingMore,
  error,
  onQueryChange,
  onLoadMore,
}: EventSeriesEventsTableViewProps) {
  const requestTimeZone = useRequestTimeZone();
  const remaining = Math.max(result.total - result.data.length, 0);

  return (
    <Stack gap="sm">
      <DataTable
        columns={buildColumns(locale, requestTimeZone, labels, locationLabels)}
        result={result}
        loading={loading}
        query={query}
        getRowKey={(event) => event.id}
        onQueryChange={onQueryChange}
        emptyMessage={labels.empty}
      >
        <DataTable.Toolbar>
          <DataTable.Search placeholder={labels.searchPlaceholder} />
          <Group gap={4}>
            <DataTable.MultiFilter fields={filterFields} allowLogicToggle={false} />
          </Group>
        </DataTable.Toolbar>
        <DataTable.Content reservedRowCount={pageSize} />
      </DataTable>
      {error ? (
        <Text c="red" size="sm">
          {error}
        </Text>
      ) : null}
      {remaining > 0 ? (
        <Group justify="center">
          <Button tone="neutral" emphasis="low" loading={isLoadingMore} onClick={onLoadMore}>
            {labels.showMore(remaining)}
          </Button>
        </Group>
      ) : null}
    </Stack>
  );
}
