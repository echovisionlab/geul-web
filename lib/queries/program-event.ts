import { isConnectErrorCode } from '@/lib/api/connect-error';
import { create } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { FilterOp, FilterSpecSchema, SortOrder, SortSpecSchema } from '@echovisionlab/geul-proto/common/common_pb.ts';
import {
  ProgramEventLocationMode as ManageProgramEventLocationMode,
  ProgramEventSeriesStatus as ManageProgramEventSeriesStatus,
  ProgramEventStatus as ManageProgramEventStatus,
  ProgramEventTypeStatus as ManageProgramEventTypeStatus,
} from '@echovisionlab/geul-proto/secure/program_event_pb.ts';
import {
  createFileClient,
  createProgramEventClient,
  createProgramEventSeriesClient,
  createProgramEventTypeClient,
  createPublicProgramEventClient,
  createPublicProgramEventClientWithAuth,
  createPublicProgramEventSeriesClientWithAuth,
} from '@/lib/api/server-client';
import { mapPublicLocalizationInfo, maybeFetchSourceLocale } from '@/lib/queries/localized-public';
import { materializeLocalizedRichTextTree } from '@/features/editor/contract/localized-rich-text';
import {
  fetchMediaDeliveryBatches,
  mergeRecordBatches,
  uniqueMediaIdsInOrder,
} from '@/lib/media/media-delivery-batches';
import { filterOpFromString } from '@/lib/types/common/proto-filter';
import {
  programEventLocationModeFilterValue,
  publicProgramEventLocationModeToString,
  type ProgramEventLocationModeValue,
} from '@/lib/types/program-event/location-mode';
import { isValidUuid } from '@/lib/utils/validation';

export type ProgramEventTimeWindow = 'upcoming' | 'current' | 'past' | 'all';

export type ProgramEventSortBy = 'starts_at' | 'ends_at' | 'published_at' | 'updated_at' | 'title';

export type { ProgramEventLocationModeValue } from '@/lib/types/program-event/location-mode';
export type ProgramEventStatusValue = 'draft' | 'published' | 'archived';
export type ProgramEventSeriesStatusValue = 'draft' | 'published';

export interface PublicProgramEventListItem {
  id: string;
  title: string;
  slug: string | null;
  summary: string | null;
  typeId: string;
  typeName: string | null;
  seriesId: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  timezone: string;
  allDay: boolean;
  locationMode: ProgramEventLocationModeValue;
  mapPlaceId: string | null;
  posterUrl: string | null;
  publishedAt: Date | null;
}

export interface AdminProgramEventListItem {
  id: string;
  title: string;
  slug: string | null;
  status: ProgramEventStatusValue;
  typeId: string;
  seriesId: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  timezone: string;
  locationMode: ProgramEventLocationModeValue;
  posterFileId: string | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
}

export interface AdminProgramEventMediaItem {
  id: string;
  fileId: string;
  url: string | null;
  role: string;
  sortOrder: number;
  isPrimary: boolean;
  alt: string | null;
  caption: string | null;
}

export interface AdminProgramEventTypeOption {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'inactive';
  sortOrder: number;
  requiresPlace: boolean;
  requiresStreamUrl: boolean;
  locales: Array<{ locale: string; name: string; description: string | null }>;
}

export interface AdminProgramEventSeriesOption {
  id: string;
  title: string;
  slug: string;
  status: ProgramEventSeriesStatusValue;
}

export interface AdminProgramEventSeriesListItem extends AdminProgramEventSeriesOption {
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface AdminProgramEventSeriesDetail {
  id: string;
  status: ProgramEventSeriesStatusValue;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  posterFileId: string | null;
  posterUrl: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface PublicProgramEventSeriesDetail {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  posterUrl: string | null;
}

function toManageProgramEventStatusValue(status: ManageProgramEventStatus): ProgramEventStatusValue {
  switch (status) {
    case ManageProgramEventStatus.PUBLISHED:
      return 'published';
    case ManageProgramEventStatus.ARCHIVED:
      return 'archived';
    case ManageProgramEventStatus.DRAFT:
    default:
      return 'draft';
  }
}

function toManageProgramEventSeriesStatusValue(status: ManageProgramEventSeriesStatus): ProgramEventSeriesStatusValue {
  return status === ManageProgramEventSeriesStatus.PUBLISHED ? 'published' : 'draft';
}

export function toManageProgramEventStatusFilterValue(status: ProgramEventStatusValue): string {
  switch (status) {
    case 'published':
      return 'PROGRAM_EVENT_STATUS_PUBLISHED';
    case 'archived':
      return 'PROGRAM_EVENT_STATUS_ARCHIVED';
    case 'draft':
    default:
      return 'PROGRAM_EVENT_STATUS_DRAFT';
  }
}

export function toManageProgramEventSeriesStatusFilterValue(status: ProgramEventSeriesStatusValue): string {
  return status === 'published' ? 'PROGRAM_EVENT_SERIES_STATUS_PUBLISHED' : 'PROGRAM_EVENT_SERIES_STATUS_DRAFT';
}

function toManageProgramEventLocationModeValue(mode: ManageProgramEventLocationMode): ProgramEventLocationModeValue {
  switch (mode) {
    case ManageProgramEventLocationMode.ONLINE:
      return 'online';
    case ManageProgramEventLocationMode.HYBRID:
      return 'hybrid';
    case ManageProgramEventLocationMode.TBA:
      return 'tba';
    case ManageProgramEventLocationMode.MAP_PLACE:
    default:
      return 'map_place';
  }
}

function toProgramEventTypeStatusValue(status: ManageProgramEventTypeStatus): 'active' | 'inactive' {
  return status === ManageProgramEventTypeStatus.INACTIVE ? 'inactive' : 'active';
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function tableFiltersToProto(filters: unknown) {
  if (!Array.isArray(filters)) {
    return [];
  }

  return filters.flatMap((item) => {
    if (item == null || typeof item !== 'object') {
      return [];
    }
    const record = item as Record<string, unknown>;
    const field = typeof record.field === 'string' ? record.field : '';
    const opToken = typeof record.op === 'string' ? record.op : 'eq';
    const op = filterOpFromString(opToken, record.value);
    if (!field || op == null) {
      return [];
    }
    if (op === FilterOp.IN && Array.isArray(record.value)) {
      return [
        create(FilterSpecSchema, {
          field,
          op,
          values: record.value.map(stringValue).filter((value): value is string => value !== null),
        }),
      ];
    }
    const value = stringValue(record.value);
    if (op === FilterOp.IS_NULL || op === FilterOp.IS_NOT_NULL || value !== null) {
      return [create(FilterSpecSchema, { field, op, value: value ?? '' })];
    }
    return [];
  });
}

async function resolveFileUrl(fileId: string | null | undefined): Promise<string | null> {
  if (!fileId) {
    return null;
  }
  try {
    const client = await createFileClient();
    const response = await client.getMediaDelivery({ fileId });
    return response.delivery?.thumbnail?.url || response.delivery?.asset?.url || response.delivery?.inline?.url || null;
  } catch {
    return null;
  }
}

async function resolveBulkFileUrls(fileIds: string[]): Promise<Record<string, string | null>> {
  const uniqueFileIds = uniqueMediaIdsInOrder(fileIds);
  if (uniqueFileIds.length === 0) {
    return {};
  }
  try {
    const client = await createFileClient();
    const responses = await fetchMediaDeliveryBatches(uniqueFileIds, (batch) =>
      client.getBulkMediaDeliveries({ fileIds: batch }),
    );
    const files = mergeRecordBatches(responses.map((response) => response.files));
    const result: Record<string, string | null> = {};
    for (const fileId of uniqueFileIds) {
      const delivery = files[fileId]?.delivery;
      result[fileId] = delivery?.thumbnail?.url || delivery?.asset?.url || delivery?.inline?.url || null;
    }
    return result;
  } catch {
    return Object.fromEntries(uniqueFileIds.map((fileId) => [fileId, null]));
  }
}

export async function listProgramEventsAdmin(input: {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: { field: string; order?: 'asc' | 'desc' }[];
  filter?: unknown;
}) {
  const client = await createProgramEventClient();
  const limit = input.pageSize ?? 20;
  const page = input.page ?? 1;
  const offset = (page - 1) * limit;
  const filters = tableFiltersToProto(input.filter);
  if (input.search) {
    filters.push(create(FilterSpecSchema, { field: 'search', op: FilterOp.ILIKE, value: input.search }));
  }
  const sorts = input.sort?.map((s) =>
    create(SortSpecSchema, {
      field: s.field,
      order: s.order === 'desc' ? SortOrder.DESC : SortOrder.ASC,
    }),
  );
  const response = await client.listProgramEventsAdmin({
    pagination: { limit, offset },
    filters,
    sorts,
  });
  const total = response.pagination?.total ?? 0;
  return {
    data: (response.events ?? []).map((event): AdminProgramEventListItem => ({
      id: event.id,
      title: event.title,
      slug: event.slug ?? null,
      status: toManageProgramEventStatusValue(event.status),
      typeId: event.typeId,
      seriesId: event.seriesId ?? null,
      startsAt: event.startsAt ? timestampDate(event.startsAt) : null,
      endsAt: event.endsAt ? timestampDate(event.endsAt) : null,
      timezone: event.timezone,
      locationMode: toManageProgramEventLocationModeValue(event.locationMode),
      posterFileId: event.posterFileId ?? null,
      publishedAt: event.publishedAt ? timestampDate(event.publishedAt) : null,
      updatedAt: event.updatedAt ? timestampDate(event.updatedAt) : null,
    })),
    total,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getProgramEventAdmin(idOrSlug: string) {
  let event;
  try {
    const client = await createProgramEventClient();
    const decoded = decodeURIComponent(idOrSlug);
    let eventId = decoded;
    if (!isValidUuid(eventId)) {
      const response = await client.listProgramEventsAdmin({
        pagination: { limit: 1, offset: 0 },
        filters: [create(FilterSpecSchema, { field: 'slug', op: FilterOp.EQ, value: decoded })],
      });
      const resolved = response.events[0];
      if (!resolved?.id) {
        return null;
      }
      eventId = resolved.id;
    }
    event = await client.getProgramEvent({ id: eventId });
  } catch (error) {
    if (isConnectErrorCode(error, Code.NotFound, Code.PermissionDenied)) {
      return null;
    }
    throw error;
  }
  const sourceLocale = event.locales.find((locale) => locale.locale === event.sourceLocale) ?? event.locales[0];

  const mediaUrls = await resolveBulkFileUrls(event.media.map((item) => item.fileId));
  const media = event.media.map((item): AdminProgramEventMediaItem => ({
    id: item.id,
    fileId: item.fileId,
    url: mediaUrls[item.fileId] ?? null,
    role: item.role,
    sortOrder: item.sortOrder,
    isPrimary: item.isPrimary,
    alt: item.alt ?? null,
    caption: item.caption ?? null,
  }));
  const primaryPoster = media.find((item) => item.role === 'poster' && item.isPrimary) ?? null;

  return {
    id: event.id,
    status: toManageProgramEventStatusValue(event.status),
    sourceLocale: event.sourceLocale,
    title: event.title,
    slug: event.slug,
    summary: sourceLocale?.summary ?? null,
    typeId: event.typeId,
    seriesId: event.seriesId ?? null,
    seriesOrder: event.seriesOrder ?? null,
    startsAt: event.startsAt ? timestampDate(event.startsAt) : null,
    endsAt: event.endsAt ? timestampDate(event.endsAt) : null,
    timezone: event.timezone,
    allDay: event.allDay,
    locationMode: toManageProgramEventLocationModeValue(event.locationMode),
    mapPlaceId: event.mapPlaceId ?? null,
    posterFileId: event.posterFileId ?? null,
    posterUrl: primaryPoster?.url ?? (await resolveFileUrl(event.posterFileId)),
    media,
    ticketUrl: event.ticketUrl ?? null,
    streamUrl: event.streamUrl ?? null,
    externalUrl: event.externalUrl ?? null,
    artists: event.artists.map((artist) => ({
      artistId: artist.artistId,
      role: artist.role ?? null,
      sortOrder: artist.sortOrder,
    })),
    labels: event.labels.map((label) => ({
      labelId: label.labelId,
      role: label.role ?? null,
      sortOrder: label.sortOrder,
    })),
    clients: event.clients.map((clientItem) => ({
      clientId: clientItem.clientId,
      role: clientItem.role ?? null,
      sortOrder: clientItem.sortOrder,
    })),
    credits: event.credits.map((credit) => ({
      id: credit.id,
      artistId: credit.artistId ?? null,
      memberId: credit.memberId ?? null,
      displayName: credit.displayName ?? null,
      creditRole: credit.creditRole ?? null,
      description: credit.description ?? null,
      sortOrder: credit.sortOrder,
      artist: credit.artist
        ? {
            id: credit.artist.id,
            name: credit.artist.name,
            slug: credit.artist.slug ?? null,
            imageUrl: credit.artist.imageAsset?.url ?? null,
          }
        : null,
      member: credit.member
        ? {
            id: credit.member.id,
            name: credit.member.nickname,
            image: credit.member.avatarAsset?.url ?? null,
          }
        : null,
    })),
  };
}

export async function listProgramEventTypesAdmin(): Promise<AdminProgramEventTypeOption[]> {
  const client = await createProgramEventTypeClient();
  const response = await client.listProgramEventTypesAdmin({
    pagination: { limit: 100, offset: 0 },
    sorts: [create(SortSpecSchema, { field: 'sort_order', order: SortOrder.ASC })],
  });
  return (response.types ?? []).map((type) => {
    const sourceLocale = type.locales[0];
    return {
      id: type.id,
      slug: type.slug,
      name: sourceLocale?.name ?? type.slug,
      status: toProgramEventTypeStatusValue(type.status),
      sortOrder: type.sortOrder,
      requiresPlace: type.requiresPlace,
      requiresStreamUrl: type.requiresStreamUrl,
      locales: type.locales.map((locale) => ({
        locale: locale.locale,
        name: locale.name,
        description: locale.description ?? null,
      })),
    };
  });
}

export async function listProgramEventSeriesAdmin(): Promise<AdminProgramEventSeriesOption[]> {
  const client = await createProgramEventSeriesClient();
  const response = await client.listProgramEventSeriesAdmin({
    pagination: { limit: 100, offset: 0 },
  });
  return (response.series ?? []).map((series) => ({
    id: series.id,
    title: series.title || series.id,
    slug: series.slug,
    status: toManageProgramEventSeriesStatusValue(series.status),
  }));
}

export async function listProgramEventSeriesTableAdmin(input: {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: { field: string; order?: 'asc' | 'desc' }[];
  filter?: unknown;
}) {
  const client = await createProgramEventSeriesClient();
  const limit = input.pageSize ?? 20;
  const page = input.page ?? 1;
  const offset = (page - 1) * limit;
  const filters = tableFiltersToProto(input.filter);
  if (input.search) {
    filters.push(create(FilterSpecSchema, { field: 'search', op: FilterOp.ILIKE, value: input.search }));
  }
  const sorts = input.sort?.map((sort) =>
    create(SortSpecSchema, {
      field: sort.field,
      order: sort.order === 'desc' ? SortOrder.DESC : SortOrder.ASC,
    }),
  );
  const response = await client.listProgramEventSeriesAdmin({
    pagination: { limit, offset },
    filters,
    sorts,
  });
  const total = response.pagination?.total ?? 0;
  return {
    data: (response.series ?? []).map((series): AdminProgramEventSeriesListItem => {
      return {
        id: series.id,
        title: series.title || series.id,
        slug: series.slug,
        status: toManageProgramEventSeriesStatusValue(series.status),
        createdAt: series.createdAt ? timestampDate(series.createdAt) : null,
        updatedAt: series.updatedAt ? timestampDate(series.updatedAt) : null,
      };
    }),
    total,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getProgramEventSeriesAdmin(id: string): Promise<AdminProgramEventSeriesDetail> {
  const client = await createProgramEventSeriesClient();
  const series = await client.getProgramEventSeries({ id });

  return {
    id: series.id,
    status: toManageProgramEventSeriesStatusValue(series.status),
    title: series.title,
    slug: series.slug,
    summary: series.summary ?? null,
    description: series.description ?? null,
    posterFileId: series.posterFileId ?? null,
    posterUrl: await resolveFileUrl(series.posterFileId),
    createdAt: series.createdAt ? timestampDate(series.createdAt) : null,
    updatedAt: series.updatedAt ? timestampDate(series.updatedAt) : null,
  };
}

export async function listProgramEventsForBlock(input: {
  search?: string;
  typeIds?: string[];
  seriesId?: string;
  locationModes?: ProgramEventLocationModeValue[];
  timeWindow?: ProgramEventTimeWindow;
  sortBy?: ProgramEventSortBy;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  requestedLocale?: string | null;
}) {
  const client = input.requestedLocale
    ? await createPublicProgramEventClientWithAuth(input.requestedLocale)
    : createPublicProgramEventClient();
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
    events: (response.events ?? []).map((event): PublicProgramEventListItem => ({
      id: event.id,
      title: event.title,
      slug: event.slug ?? null,
      summary: event.summary ?? null,
      typeId: event.typeId,
      typeName: event.type?.name ?? null,
      seriesId: event.seriesId ?? null,
      startsAt: event.startsAt ? timestampDate(event.startsAt) : null,
      endsAt: event.endsAt ? timestampDate(event.endsAt) : null,
      timezone: event.timezone,
      allDay: event.allDay,
      locationMode: publicProgramEventLocationModeToString(event.locationMode),
      mapPlaceId: event.mapPlaceId ?? null,
      posterUrl: event.posterAsset?.url ?? null,
      publishedAt: event.publishedAt ? timestampDate(event.publishedAt) : null,
    })),
    pagination: {
      total: response.pagination?.total ?? 0,
      limit: response.pagination?.limit ?? limit,
      offset: response.pagination?.offset ?? offset,
      hasMore: response.pagination?.hasMore ?? false,
    },
  };
}

export async function listProgramEventsForSeries(input: {
  seriesId: string;
  search?: string;
  typeIds?: string[];
  locationModes?: ProgramEventLocationModeValue[];
  sortBy?: ProgramEventSortBy;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  requestedLocale?: string | null;
}) {
  return listProgramEventsForBlock({
    search: input.search,
    typeIds: input.typeIds,
    seriesId: input.seriesId,
    locationModes: input.locationModes,
    timeWindow: 'all',
    sortBy: input.sortBy ?? 'starts_at',
    sortOrder: input.sortOrder ?? 'asc',
    limit: input.limit,
    offset: input.offset,
    requestedLocale: input.requestedLocale,
  });
}

export async function getProgramEventView(
  idOrSlug: string,
  options?: { preferSourceLocale?: boolean; requestedLocale?: string | null },
) {
  const slug = decodeURIComponent(idOrSlug);
  let response;
  try {
    const client = await createPublicProgramEventClientWithAuth(options?.requestedLocale);
    response = await client.get({ slug });
    response = await maybeFetchSourceLocale({
      preferSourceLocale: options?.preferSourceLocale,
      initialResponse: response,
      entity: response.event ?? null,
      fetchWithLocale: async (locale) => {
        const sourceClient = await createPublicProgramEventClientWithAuth(locale);
        return sourceClient.get({ slug });
      },
    });
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    throw err;
  }

  const event = response.event;
  if (!event) {
    return null;
  }

  const content = event.document ? materializeLocalizedRichTextTree(event.document) : null;

  return {
    id: event.id,
    title: event.title,
    slug: event.slug ?? null,
    summary: event.summary ?? null,
    content,
    blockMedia: response.blockMedia,
    typeId: event.typeId,
    type: event.type
      ? {
          id: event.type.id,
          slug: event.type.slug,
          name: event.type.name,
          description: event.type.description ?? null,
        }
      : null,
    seriesId: event.seriesId ?? null,
    series: event.series
      ? {
          id: event.series.id,
          slug: event.series.slug,
          title: event.series.title,
          summary: event.series.summary ?? null,
        }
      : null,
    seriesOrder: event.seriesOrder ?? null,
    startsAt: event.startsAt ? timestampDate(event.startsAt) : null,
    endsAt: event.endsAt ? timestampDate(event.endsAt) : null,
    timezone: event.timezone,
    allDay: event.allDay,
    locationMode: publicProgramEventLocationModeToString(event.locationMode),
    mapPlaceId: event.mapPlaceId ?? null,
    locationPlace: event.locationPlace
      ? {
          id: event.locationPlace.id,
          name: event.locationPlace.name,
          lat: event.locationPlace.lat,
          lng: event.locationPlace.lng,
          googlePlaceId: event.locationPlace.googlePlaceId ?? null,
          address: event.locationPlace.address ?? null,
        }
      : null,
    posterUrl: event.posterAsset?.url ?? null,
    ticketUrl: event.ticketUrl ?? null,
    streamUrl: event.streamUrl ?? null,
    externalUrl: event.externalUrl ?? null,
    artists: event.artists.map((artist) => ({
      id: artist.id,
      name: artist.name,
      slug: artist.slug ?? null,
      role: artist.role ?? null,
    })),
    labels: event.labels.map((label) => ({
      id: label.id,
      name: label.name,
      slug: label.slug ?? null,
      role: label.role ?? null,
    })),
    clients: event.clients.map((client) => ({
      id: client.id,
      name: client.name,
      website: client.website ?? null,
      role: client.role ?? null,
    })),
    credits: event.credits.map((credit) => ({
      id: credit.id,
      name: credit.displayName ?? credit.artist?.name ?? credit.member?.nickname ?? null,
      creditRole: credit.creditRole ?? null,
      description: credit.description ?? null,
      artist: credit.artist
        ? {
            id: credit.artist.id,
            name: credit.artist.name,
            slug: credit.artist.slug ?? null,
          }
        : null,
      member: credit.member
        ? {
            id: credit.member.id,
            name: credit.member.nickname,
            image: credit.member.avatarAsset?.url ?? null,
          }
        : null,
    })),
    publishedAt: event.publishedAt ? timestampDate(event.publishedAt) : null,
    updatedAt: event.updatedAt ? timestampDate(event.updatedAt) : null,
    localizationInfo: mapPublicLocalizationInfo(event.localizationInfo),
  };
}

export async function getProgramEventSeriesView(idOrSlug: string): Promise<PublicProgramEventSeriesDetail | null> {
  const slug = decodeURIComponent(idOrSlug);
  try {
    const client = await createPublicProgramEventSeriesClientWithAuth();
    const response = await client.get({ slug });

    const series = response.series;
    if (!series) {
      return null;
    }

    return {
      id: series.id,
      title: series.title,
      slug: series.slug,
      summary: series.summary ?? null,
      description: series.description ?? null,
      posterUrl: series.posterAsset?.url ?? null,
    };
  } catch {
    return null;
  }
}
