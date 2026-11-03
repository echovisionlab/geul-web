'use client';

import {
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
} from '@/components/core/Layout';

import { Text as DsText } from '@/components/core/Typography';

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
  image: string;
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
  loadMoreDisabled: boolean;
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
  labels: Pick<EventSeriesEventsTableViewLabels, 'image' | 'date' | 'event' | 'type' | 'location' | 'tba'>,
  locationLabels: Record<BrowserProgramEventLocationMode, string>,
): ColumnDef<EventSeriesEventsTableItem>[] {
  return [
    {
      key: 'poster',
      header: '',
      accessibleLabel: labels.image,
      width: 72,
      cell: (event) => (
        <div style={{ width: 48, height: 64, overflow: 'hidden' }}>
          <DsLayoutInset space="none">
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
          </DsLayoutInset>
        </div>
      ),
    },
    {
      key: 'title',
      header: labels.event,
      cell: (event) => (
        <DsLayoutStack gap="xxs">
          <TextButton href={event.href} size="sm" appearance="default">
            {event.title}
          </TextButton>
          {event.summary ? (
            <DsText size="sm" tone="secondary" lines={2}>
              {event.summary}
            </DsText>
          ) : null}
        </DsLayoutStack>
      ),
    },
    {
      key: 'startsAt',
      header: labels.date,
      width: 180,
      cell: (event) => (
        <DsText size="sm" tone="secondary" nowrap>
          {formatEventDate(event, locale, requestTimeZone, labels.tba)}
        </DsText>
      ),
    },
    {
      key: 'typeName',
      header: labels.type,
      width: 160,
      cell: (event) => (
        <DsText size="sm" tone={event.typeName ? undefined : 'secondary'}>
          {event.typeName || '-'}
        </DsText>
      ),
    },
    {
      key: 'locationMode',
      header: labels.location,
      width: 140,
      cell: (event) => (
        <DsText size="sm" tone="secondary">
          {locationLabels[event.locationMode]}
        </DsText>
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
  loadMoreDisabled,
  error,
  onQueryChange,
  onLoadMore,
}: EventSeriesEventsTableViewProps) {
  const requestTimeZone = useRequestTimeZone();
  const remaining = Math.max(result.total - result.data.length, 0);

  return (
    <DsLayoutStack gap="sm">
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
          <DsLayoutInline gap="xxs">
            <DataTable.MultiFilter fields={filterFields} allowLogicToggle={false} />
          </DsLayoutInline>
        </DataTable.Toolbar>
        <DataTable.Content reservedRowCount={loading ? pageSize : undefined} />
      </DataTable>
      {error ? (
        <DsText tone="danger" size="sm">
          {error}
        </DsText>
      ) : null}
      {remaining > 0 ? (
        <DsLayoutInline justify="center">
          <Button
            tone="neutral"
            emphasis="low"
            loading={isLoadingMore}
            disabled={loadMoreDisabled}
            onClick={onLoadMore}
          >
            {labels.showMore(remaining)}
          </Button>
        </DsLayoutInline>
      ) : null}
    </DsLayoutStack>
  );
}
