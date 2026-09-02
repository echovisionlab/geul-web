import { isConnectErrorCode } from '@/lib/api/connect-error';
import { create } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { FilterOp, FilterSpecSchema, SortOrder, SortSpecSchema } from '@echovisionlab/geul-proto/common/common_pb.ts';
import {
  WorkStatus as PublicWorkStatus,
  WorkType as PublicWorkType,
} from '@echovisionlab/geul-proto/public/work_pb.ts';
import { WORK_TABLE_FILTER_FIELD_DEFINITIONS, WORK_TABLE_SORT_FIELD_DEFINITIONS } from '@/lib/types/work/table-spec';
import { createPublicWorkClient, createPublicWorkClientWithAuth, createWorkClient } from '@/lib/api/server-client';
import { materializeLocalizedRichTextTree } from '@/features/editor/contract/localized-rich-text';
import { mapPublicLocalizationInfo, maybeFetchSourceLocale } from '@/lib/queries/localized-public';
import {
  buildWorkMapFeatureRequest,
  mapWorkMapFeatureResponse,
  type WorkMapFeatureRequestInput,
} from '@/lib/queries/map-features';
import {
  buildPublicTableRequest,
  type PublicTableFilterFieldSpec,
  type PublicTableSortFieldSpec,
} from '@/lib/queries/public-table';
import type { PaginatedQuery } from '@/lib/types/common/query';
import { WORK_TYPE_FILTER_VALUES, type WorkType as WorkTypeValue } from '@/lib/types/work/model';
import {
  publicWorkStatusToString,
  publicWorkTypeToString,
  workStatusToString,
  workTypeToString,
} from '@/lib/types/work/proto';
import { mapWorkCredits } from '@/lib/types/work/credit';
import { createLogger } from '@/lib/utils/logger';
import { themedAssetRefUrl } from '@/lib/utils/asset-ref';
import { isValidUuid } from '@/lib/utils/validation';

const logger = createLogger('work-queries');

function toLocationPlace(
  place?: { name: string; lat: number; lng: number; googlePlaceId?: string } | null,
): { name: string; lat: number; lng: number; googlePlaceId: string | null } | null {
  if (!place) {
    return null;
  }

  return {
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    googlePlaceId: place.googlePlaceId ?? null,
  };
}

export interface PublicWorkTableRow {
  id: string;
  slug: string | null;
  title: string;
  type: string;
  year: number;
  month: number;
  untilYear: number | null;
  untilMonth: number | null;
  isPresent: boolean;
  featured: boolean;
  publishedAt: string | null;
}

// === View Queries (Public) ===

export async function getWorkView(
  idOrSlug: string,
  options?: { preferSourceLocale?: boolean; requestedLocale?: string | null },
) {
  try {
    const slug = decodeURIComponent(idOrSlug);
    const client = await createPublicWorkClientWithAuth(options?.requestedLocale);
    let response = await client.get({ slug });
    response = await maybeFetchSourceLocale({
      preferSourceLocale: options?.preferSourceLocale,
      initialResponse: response,
      entity: response.work ?? null,
      fetchWithLocale: async (locale) => {
        const sourceClient = await createPublicWorkClientWithAuth(locale);
        return sourceClient.get({ slug });
      },
    });

    const workData = response.work;
    if (!workData) {
      return null;
    }

    const content = workData.document ? materializeLocalizedRichTextTree(workData.document) : null;

    return {
      id: workData.id,
      title: workData.title,
      slug: workData.slug ?? null,
      type: publicWorkTypeToString(workData.type ?? PublicWorkType.MUSIC_PROJECT),
      year: workData.year,
      month: workData.month,
      untilYear: workData.untilYear ?? null,
      untilMonth: workData.untilMonth ?? null,
      isPresent: workData.isPresent,
      summary: workData.summary ?? null,
      mapPlaceId: workData.mapPlaceId ?? null,
      locationPlace: toLocationPlace(workData.locationPlace ?? null),
      featuredImageUrl: workData.featuredImageAsset?.url ?? null,
      metadata: (workData.metadata as Record<string, unknown>) ?? null,
      featured: workData.featured ?? false,
      status: publicWorkStatusToString(workData.status ?? PublicWorkStatus.DRAFT),
      content,
      blockMedia: response.blockMedia,
      localizationInfo: mapPublicLocalizationInfo(workData.localizationInfo),
      createdAt: workData.createdAt ? timestampDate(workData.createdAt) : null,
      updatedAt: workData.updatedAt ? timestampDate(workData.updatedAt) : null,
      publishedAt: workData.publishedAt ? timestampDate(workData.publishedAt) : null,
      creditGroups: (workData.creditGroups ?? []).map((group, sortOrder) => ({
        id: group.id,
        name: group.name,
        sortOrder,
      })),
      credits: mapWorkCredits(workData.credits ?? []),
      clients: (workData.clients ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        logoUrl: themedAssetRefUrl(c.logoLightAsset, c.logoDarkAsset),
        logoLightUrl: c.logoLightAsset?.url ?? null,
        logoDarkUrl: c.logoDarkAsset?.url ?? null,
        website: c.website ?? null,
      })),
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    throw err;
  }
}

export async function getWorkViewWithShareToken(
  idOrSlug: string,
  shareToken: string,
  requestedLocale?: string | null,
  sharePassword?: string,
) {
  try {
    const client = await createPublicWorkClientWithAuth(requestedLocale);
    const response = await client.get({
      slug: decodeURIComponent(idOrSlug),
      shareToken,
      sharePassword,
    });

    const workData = response.work;
    if (!workData) {
      return null;
    }

    const content = workData.document ? materializeLocalizedRichTextTree(workData.document) : null;

    return {
      id: workData.id,
      title: workData.title,
      slug: workData.slug ?? null,
      type: publicWorkTypeToString(workData.type ?? PublicWorkType.MUSIC_PROJECT),
      year: workData.year,
      month: workData.month,
      untilYear: workData.untilYear ?? null,
      untilMonth: workData.untilMonth ?? null,
      isPresent: workData.isPresent,
      summary: workData.summary ?? null,
      mapPlaceId: workData.mapPlaceId ?? null,
      locationPlace: toLocationPlace(workData.locationPlace ?? null),
      featuredImageUrl: workData.featuredImageAsset?.url ?? null,
      metadata: (workData.metadata as Record<string, unknown>) ?? null,
      featured: workData.featured ?? false,
      status: publicWorkStatusToString(workData.status ?? PublicWorkStatus.DRAFT),
      content,
      blockMedia: response.blockMedia,
      localizationInfo: mapPublicLocalizationInfo(workData.localizationInfo),
      createdAt: workData.createdAt ? timestampDate(workData.createdAt) : null,
      updatedAt: workData.updatedAt ? timestampDate(workData.updatedAt) : null,
      publishedAt: workData.publishedAt ? timestampDate(workData.publishedAt) : null,
      creditGroups: (workData.creditGroups ?? []).map((group, sortOrder) => ({
        id: group.id,
        name: group.name,
        sortOrder,
      })),
      credits: mapWorkCredits(workData.credits ?? []),
      clients: (workData.clients ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        logoUrl: themedAssetRefUrl(c.logoLightAsset, c.logoDarkAsset),
        logoLightUrl: c.logoLightAsset?.url ?? null,
        logoDarkUrl: c.logoDarkAsset?.url ?? null,
        website: c.website ?? null,
      })),
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    throw err;
  }
}

// === Edit Access Queries ===

export async function getWorkForEdit(idOrSlug: string) {
  try {
    const decoded = decodeURIComponent(idOrSlug);
    let workId = decoded;

    if (!isValidUuid(workId)) {
      const publicClient = await createPublicWorkClientWithAuth();
      const response = await publicClient.get({ slug: decoded });
      if (!response.work?.id) {
        return null;
      }
      workId = response.work.id;
    }

    const client = await createWorkClient();
    const work = await client.getWork({ id: workId });

    return {
      id: work.id,
      title: work.title,
      slug: work.slug ?? null,
      type: workTypeToString(work.type),
      year: work.year,
      month: work.month,
      untilYear: work.untilYear ?? null,
      untilMonth: work.untilMonth ?? null,
      isPresent: work.isPresent,
      summary: work.summary ?? null,
      mapPlaceId: work.mapPlaceId ?? null,
      featuredImageUrl: work.featuredImageAsset?.url ?? null,
      metadata: (work.metadata as Record<string, unknown>) ?? null,
      featured: work.featured,
      status: workStatusToString(work.status),
      created_at: work.createdAt ? timestampDate(work.createdAt) : null,
      updated_at: work.updatedAt ? timestampDate(work.updatedAt) : null,
      published_at: work.publishedAt ? timestampDate(work.publishedAt) : null,
      ogImageUrl: work.ogAsset?.url ?? null,
      clientIds: (work.clients ?? []).map((c) => c.id),
      clientDetails: (work.clients ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        logoUrl: themedAssetRefUrl(c.logoLightAsset, c.logoDarkAsset),
        logoLightUrl: c.logoLightAsset?.url ?? null,
        logoDarkUrl: c.logoDarkAsset?.url ?? null,
        website: c.website ?? null,
      })),
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    if (isConnectErrorCode(err, Code.PermissionDenied)) {
      return null;
    }
    throw err;
  }
}

// === List Queries ===

export async function listWorksForGallery(options?: {
  types?: WorkTypeValue[];
  featuredOnly?: boolean;
  limit?: number;
  offset?: number;
  year?: number;
  month?: number;
  sortBy?: 'title' | 'published_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
  requestedLocale?: string | null;
}) {
  try {
    const client = options?.requestedLocale
      ? await createPublicWorkClientWithAuth(options.requestedLocale)
      : createPublicWorkClient();
    const filters: Array<{ field: string; op: FilterOp; value: string }> = [];

    if (typeof options?.year === 'number') {
      filters.push({
        field: 'year',
        op: FilterOp.EQ,
        value: String(options.year),
      });
    }

    if (typeof options?.month === 'number') {
      filters.push({
        field: 'month',
        op: FilterOp.EQ,
        value: String(options.month),
      });
    }

    if (options?.types && options.types.length > 0) {
      filters.push(
        create(FilterSpecSchema, {
          field: 'type',
          op: FilterOp.IN,
          values: options.types.map((type) => WORK_TYPE_FILTER_VALUES[type]),
        }),
      );
    }

    if (options?.featuredOnly) {
      filters.push(
        create(FilterSpecSchema, {
          field: 'featured',
          op: FilterOp.EQ,
          value: 'true',
        }),
      );
    }

    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const response = await client.list({
      pagination: { limit, offset },
      filters: filters.length > 0 ? filters : undefined,
      sorts: options?.sortBy
        ? [
            create(SortSpecSchema, {
              field: options.sortBy,
              order: options.sortOrder === 'asc' ? SortOrder.ASC : SortOrder.DESC,
            }),
          ]
        : undefined,
    });

    return {
      works: (response.works ?? []).map((w) => ({
        id: w.id,
        title: w.title,
        slug: w.slug ?? null,
        type: publicWorkTypeToString(w.type),
        summary: w.summary ?? null,
        featuredImageUrl: w.featuredImageAsset?.url ?? null,
        featured: w.featured,
        mapPlaceId: w.mapPlaceId ?? null,
        publishedAt: w.publishedAt ? timestampDate(w.publishedAt) : null,
      })),
      pagination: {
        total: response.pagination?.total ?? 0,
        limit,
        offset,
      },
    };
  } catch (err) {
    logger.error('Failed to list works for gallery', { error: err });
    return {
      works: [],
      pagination: {
        total: 0,
        limit: options?.limit ?? 20,
        offset: options?.offset ?? 0,
      },
    };
  }
}

export async function listWorkMapFeatures(
  input: WorkMapFeatureRequestInput & {
    requestedLocale?: string | null;
  },
) {
  const client = input.requestedLocale
    ? await createPublicWorkClientWithAuth(input.requestedLocale)
    : createPublicWorkClient();
  const response = await client.listMapFeatures(buildWorkMapFeatureRequest(input));
  return mapWorkMapFeatureResponse(response);
}

export async function listPublishedWorksTable(input: {
  query: PaginatedQuery;
  pageSize?: number;
  types?: WorkTypeValue[];
  featuredOnly?: boolean;
  statuses?: string[];
  allowedFilterFields?: readonly PublicTableFilterFieldSpec[];
  allowedSortFields?: readonly PublicTableSortFieldSpec[];
  rejectInvalidQuery?: boolean;
  requestedLocale?: string | null;
}) {
  const client = input.requestedLocale
    ? await createPublicWorkClientWithAuth(input.requestedLocale)
    : createPublicWorkClient();
  const request = buildPublicTableRequest({
    query: input.query,
    defaultPageSize: input.pageSize ?? 10,
    allowedFilterFields: input.allowedFilterFields ?? WORK_TABLE_FILTER_FIELD_DEFINITIONS,
    allowedSortFields: input.allowedSortFields ?? WORK_TABLE_SORT_FIELD_DEFINITIONS,
    baseFilters: [
      ...(input.statuses && input.statuses.length > 0
        ? [{ field: 'status', op: FilterOp.IN, values: input.statuses }]
        : []),
      ...(input.types && input.types.length > 0
        ? [
            {
              field: 'type',
              op: FilterOp.IN,
              values: input.types.map((type) => WORK_TYPE_FILTER_VALUES[type]),
            },
          ]
        : []),
      ...(input.featuredOnly ? [{ field: 'featured', op: FilterOp.EQ, value: 'true' }] : []),
    ],
    rejectInvalidQuery: input.rejectInvalidQuery ?? false,
  });

  const response = await client.list({
    pagination: request.pagination,
    filters: request.filters,
    sorts: request.sorts,
  });

  const total = response.pagination?.total ?? 0;

  return {
    data: (response.works ?? []).map((work): PublicWorkTableRow => ({
      id: work.id,
      slug: work.slug ?? null,
      title: work.title,
      type: publicWorkTypeToString(work.type ?? PublicWorkType.MUSIC_PROJECT),
      year: work.year,
      month: work.month,
      untilYear: work.untilYear ?? null,
      untilMonth: work.untilMonth ?? null,
      isPresent: work.isPresent,
      featured: work.featured ?? false,
      publishedAt: work.publishedAt ? timestampDate(work.publishedAt).toISOString() : null,
    })),
    total,
    page: request.page,
    pageSize: request.pageSize,
    totalPages: Math.ceil(total / request.pageSize),
  };
}
