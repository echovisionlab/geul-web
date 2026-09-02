'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import type { FilterFieldConfig } from '@/features/data-table/DataTableMultiFilter';
import {
  EventSeriesEventsTableView,
  type EventSeriesEventsFilterField,
  type EventSeriesEventsQuery,
  type EventSeriesEventsTableItem,
} from '@/features/program-event/EventSeriesEventsTableView';
import {
  listProgramEventsForBlockBrowser,
  listProgramEventTypeOptionsBrowser,
  type BrowserProgramEventLocationMode,
} from '@/lib/queries/program-event-browser';
import type { FilterSpec } from '@/lib/types/common/filter';
import type { PaginatedQuery } from '@/lib/types/common/query';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';

export type { EventSeriesEventsTableItem } from '@/features/program-event/EventSeriesEventsTableView';

interface EventSeriesEventsTablePagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface EventSeriesEventsTableProps {
  seriesId: string;
  initialEvents: EventSeriesEventsTableItem[];
  initialPagination: EventSeriesEventsTablePagination;
  pageSize: number;
  requestedLocale?: string | null;
  locale?: string;
}

const eventSeriesEventsFilterFields = new Set<string>(['type_id', 'location_mode']);

function normalizeQuery(query: PaginatedQuery): EventSeriesEventsQuery {
  const filters = query.filters?.filter((filter): filter is FilterSpec<EventSeriesEventsFilterField> =>
    eventSeriesEventsFilterFields.has(filter.field),
  );

  return {
    page: 1,
    pageSize: query.pageSize,
    search: query.search,
    filters: filters && filters.length > 0 ? filters : undefined,
    filterBy: query.filterBy,
  };
}

function toTableItem(
  event: Awaited<ReturnType<typeof listProgramEventsForBlockBrowser>>['events'][number],
): EventSeriesEventsTableItem {
  return {
    id: event.id,
    href: event.href,
    title: event.title,
    summary: event.summary ?? null,
    typeName: event.typeName,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
    allDay: event.allDay,
    locationMode: event.locationMode,
    posterUrl: event.imageUrl,
    publishedAt: event.publishedAt,
  };
}

function getFilterValues(
  filters: FilterSpec<EventSeriesEventsFilterField>[] | undefined,
  field: EventSeriesEventsFilterField,
): string[] {
  const values: string[] = [];
  for (const filter of filters ?? []) {
    if (filter.field !== field) {
      continue;
    }
    if (filter.op === 'in' && Array.isArray(filter.value)) {
      values.push(...filter.value.map(String));
    } else if (filter.op === 'eq' && typeof filter.value === 'string') {
      values.push(filter.value);
    }
  }
  return values;
}

function isDefaultQuery(query: EventSeriesEventsQuery) {
  return !query.search && (!query.filters || query.filters.length === 0);
}

async function fetchEventSeriesEvents(input: {
  seriesId: string;
  query: EventSeriesEventsQuery;
  offset: number;
  pageSize: number;
  requestedLocale?: string | null;
}): Promise<PaginatedQueryResult<EventSeriesEventsTableItem>> {
  const response = await listProgramEventsForBlockBrowser({
    search: input.query.search,
    typeIds: getFilterValues(input.query.filters, 'type_id'),
    locationModes: getFilterValues(input.query.filters, 'location_mode') as BrowserProgramEventLocationMode[],
    seriesId: input.seriesId,
    timeWindow: 'all',
    sortBy: 'starts_at',
    sortOrder: 'asc',
    limit: input.pageSize,
    offset: input.offset,
    requestedLocale: input.requestedLocale,
  });

  return {
    data: response.events.map(toTableItem),
    total: response.pagination.total,
    page: 1,
    pageSize: input.pageSize,
    totalPages: Math.ceil(response.pagination.total / input.pageSize),
  };
}

export function EventSeriesEventsTable({
  seriesId,
  initialEvents,
  initialPagination,
  pageSize,
  requestedLocale,
  locale: localeProp,
}: EventSeriesEventsTableProps) {
  const contextLocale = useLocale();
  const locale = localeProp || contextLocale;
  const tCommonLabels = useTranslations('common.labels');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const tProgramEventAdmin = useTranslations('programEventAdmin');
  const tShareLinks = useTranslations('shareLinks');
  const tCommonErrors = useTranslations('common.errors');
  const [query, setQuery] = useState<EventSeriesEventsQuery>({
    page: 1,
    pageSize,
  });
  const initialResult = useMemo(
    () => ({
      data: initialEvents,
      total: initialPagination.total,
      page: 1,
      pageSize,
      totalPages: Math.ceil(initialPagination.total / pageSize),
    }),
    [initialEvents, initialPagination.total, pageSize],
  );
  const [result, setResult] = useState<PaginatedQueryResult<EventSeriesEventsTableItem>>(initialResult);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locationLabels: Record<BrowserProgramEventLocationMode, string> = {
    map_place: tProgramEventAdmin('locationModes.mapPlace'),
    online: tProgramEventAdmin('locationModes.online'),
    hybrid: tProgramEventAdmin('locationModes.hybrid'),
    tba: tProgramEventAdmin('locationModes.tba'),
  };
  const { data: typeOptions = [] } = useQuery({
    queryKey: ['program-event-types', requestedLocale],
    queryFn: () => listProgramEventTypeOptionsBrowser(requestedLocale),
  });
  const filterFields: FilterFieldConfig[] = useMemo(
    () => [
      {
        field: 'type_id',
        label: tCommonLabels('type'),
        type: 'uuid',
        operators: ['in'],
        options: typeOptions.map((type) => ({ value: type.id, label: type.name })),
      },
      {
        field: 'location_mode',
        label: tCommonLabels('location'),
        type: 'string',
        operators: ['in'],
        options: [
          { value: 'map_place', label: locationLabels.map_place },
          { value: 'online', label: locationLabels.online },
          { value: 'hybrid', label: locationLabels.hybrid },
          { value: 'tba', label: locationLabels.tba },
        ],
      },
    ],
    [locationLabels, tCommonLabels, typeOptions],
  );
  const { data, isFetching } = useQuery({
    queryKey: ['program-event-series-events', seriesId, requestedLocale, query],
    queryFn: () =>
      fetchEventSeriesEvents({
        seriesId,
        query,
        offset: 0,
        pageSize,
        requestedLocale,
      }),
    initialData: isDefaultQuery(query) ? initialResult : undefined,
  });

  useEffect(() => {
    if (data) {
      setResult(data);
    }
  }, [data]);

  const handleQueryChange = (nextQuery: PaginatedQuery) => {
    const normalized = normalizeQuery(nextQuery);
    setError(null);
    setQuery({
      page: 1,
      pageSize,
      search: normalized.search,
      filters: normalized.filters,
      filterBy: normalized.filterBy,
    });
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || isFetching || result.data.length >= result.total) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);
    try {
      const nextResult = await fetchEventSeriesEvents({
        seriesId,
        query,
        offset: result.data.length,
        pageSize,
        requestedLocale,
      });
      setResult((current) => {
        const seen = new Set(current.data.map((event) => event.id));
        const next = nextResult.data.filter((event) => !seen.has(event.id));
        const data = [...current.data, ...next];
        return {
          data,
          total: nextResult.total,
          page: 1,
          pageSize,
          totalPages: Math.ceil(nextResult.total / pageSize),
        };
      });
    } catch {
      setError(tCommonErrors('generic'));
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <EventSeriesEventsTableView
      result={result}
      loading={isFetching && !data}
      query={query}
      pageSize={pageSize}
      locale={locale}
      labels={{
        date: tProgramEventAdmin('public.date'),
        event: tCommonLabels('event'),
        type: tCommonLabels('type'),
        location: tCommonLabels('location'),
        tba: tProgramEventAdmin('locationModes.tba'),
        empty: tProgramEventAdmin('public.empty'),
        searchPlaceholder: tCommonPlaceholders('search'),
        showMore: (count) => tShareLinks('showMore', { count }),
      }}
      locationLabels={locationLabels}
      filterFields={filterFields}
      isLoadingMore={isLoadingMore}
      error={error}
      onQueryChange={handleQueryChange}
      onLoadMore={handleLoadMore}
    />
  );
}
