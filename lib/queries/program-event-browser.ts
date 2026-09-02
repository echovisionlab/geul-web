import { create } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { FilterOp, FilterSpecSchema, SortOrder, SortSpecSchema } from '@echovisionlab/geul-proto/common/common_pb.ts';
import {
  createPublicProgramEventClientWithLocale,
  createPublicProgramEventSeriesClientWithLocale,
  createPublicProgramEventTypeClientWithLocale,
} from '@/lib/api/browser-client';
import {
  programEventLocationModeFilterValue,
  publicProgramEventLocationModeToString,
  type ProgramEventLocationModeValue,
} from '@/lib/types/program-event/location-mode';

export type BrowserProgramEventTimeWindow = 'upcoming' | 'current' | 'past' | 'all';
export type BrowserProgramEventLocationMode = ProgramEventLocationModeValue;
export type BrowserProgramEventSortBy = 'starts_at' | 'ends_at' | 'published_at' | 'updated_at' | 'title';

export async function listProgramEventTypeOptionsBrowser(requestedLocale?: string | null) {
  try {
    const client = createPublicProgramEventTypeClientWithLocale(requestedLocale);
    const response = await client.list({
      pagination: { limit: 100, offset: 0 },
      sorts: [create(SortSpecSchema, { field: 'sort_order', order: SortOrder.ASC })],
    });
    return (response.types ?? []).map((type) => ({
      id: type.id,
      slug: type.slug,
      name: type.name,
    }));
  } catch {
    return [];
  }
}

export async function listProgramEventSeriesOptionsBrowser(requestedLocale?: string | null) {
  try {
    const client = createPublicProgramEventSeriesClientWithLocale(requestedLocale);
    const response = await client.list({
      pagination: { limit: 100, offset: 0 },
    });
    return (response.series ?? []).map((series) => ({
      id: series.id,
      slug: series.slug,
      title: series.title,
    }));
  } catch {
    return [];
  }
}

export async function listProgramEventsForBlockBrowser(input: {
  search?: string;
  typeIds?: string[];
  seriesId?: string;
  locationModes?: BrowserProgramEventLocationMode[];
  timeWindow?: BrowserProgramEventTimeWindow;
  sortBy?: BrowserProgramEventSortBy;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  requestedLocale?: string | null;
}) {
  const client = createPublicProgramEventClientWithLocale(input.requestedLocale);
  const filters = [];
  const search = input.search?.trim();
  if (search) {
    filters.push(create(FilterSpecSchema, { field: 'search', op: FilterOp.ILIKE, value: search }));
  }
  if (input.typeIds && input.typeIds.length > 0) {
    filters.push(create(FilterSpecSchema, { field: 'type_id', op: FilterOp.IN, values: input.typeIds }));
  }
  if (input.locationModes && input.locationModes.length > 0) {
    filters.push(
      create(FilterSpecSchema, {
        field: 'location_mode',
        op: FilterOp.IN,
        values: input.locationModes.map(programEventLocationModeFilterValue),
      }),
    );
  }
  if (input.seriesId) {
    filters.push(create(FilterSpecSchema, { field: 'series_id', op: FilterOp.EQ, value: input.seriesId }));
  }
  if (input.timeWindow && input.timeWindow !== 'all') {
    filters.push(
      create(FilterSpecSchema, {
        field: 'time_window',
        op: FilterOp.EQ,
        value: input.timeWindow,
      }),
    );
  }

  const sorts = input.sortBy
    ? [
        create(SortSpecSchema, {
          field: input.sortBy,
          order: input.sortOrder === 'desc' ? SortOrder.DESC : SortOrder.ASC,
        }),
      ]
    : [];
  const limit = input.limit ?? 6;
  const offset = input.offset ?? 0;
  const response = await client.list({
    pagination: { limit, offset },
    filters,
    sorts,
  });

  return {
    events: (response.events ?? []).map((event) => ({
      id: event.id,
      href: `/events/${event.slug || event.id}`,
      title: event.title,
      summary: event.summary ?? null,
      imageUrl: event.posterAsset?.url ?? null,
      imageAlt: event.title,
      typeName: event.type?.name ?? null,
      startsAt: event.startsAt ? timestampDate(event.startsAt).toISOString() : null,
      endsAt: event.endsAt ? timestampDate(event.endsAt).toISOString() : null,
      timezone: event.timezone,
      allDay: event.allDay,
      locationMode: publicProgramEventLocationModeToString(event.locationMode),
      publishedAt: event.publishedAt ? timestampDate(event.publishedAt).toISOString() : null,
    })),
    pagination: {
      total: response.pagination?.total ?? 0,
      limit: response.pagination?.limit ?? limit,
      offset: response.pagination?.offset ?? offset,
      hasMore: response.pagination?.hasMore ?? false,
    },
  };
}
