import { isConnectError, isConnectErrorCode } from '@/lib/api/connect-error';
import { create } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { FilterOp, FilterSpecSchema, SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { createPublicSeriesClientWithAuth, createSeriesClient } from '@/lib/api/server-client';
import { mapPublicLocalizationInfo } from '@/lib/queries/localized-public';
import type { SeriesStatus } from '@/lib/types/series/model';
import { fromApiSeriesStatus, toApiSeriesStatus } from '@/lib/types/series/status';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('series-queries');

// ============================================
// Server Component queries for Series domain
// ============================================

interface SeriesListInput {
  search?: string;
  status?: SeriesStatus;
  page?: number;
  pageSize?: number;
  sort?: { field: string; order?: 'asc' | 'desc' }[];
}

export async function listSeriesAdmin(input: SeriesListInput) {
  try {
    const client = await createSeriesClient();
    const limit = input.pageSize ?? 20;
    const offset = ((input.page ?? 1) - 1) * limit;

    const filters = [];
    if (input.status) {
      const apiStatus = toApiSeriesStatus(input.status);
      if (apiStatus) {
        filters.push(create(FilterSpecSchema, { field: 'status', op: FilterOp.EQ, value: apiStatus }));
      }
    }
    if (input.search) {
      filters.push(create(FilterSpecSchema, { field: 'search', op: FilterOp.ILIKE, value: input.search }));
    }
    const allowedSortFields = new Set(['title', 'status', 'created_at', 'updated_at']);
    const response = await client.listSeriesAdmin({
      pagination: { limit, offset },
      filters,
      sorts: input.sort
        ?.filter((sort) => allowedSortFields.has(sort.field))
        .map((sort) => ({
          field: sort.field,
          order: sort.order === 'desc' ? SortOrder.DESC : SortOrder.ASC,
        })),
    });

    const total = response.pagination?.total ?? 0;
    return {
      data: (response.series ?? []).map((s) => ({
        id: s.series?.id ?? '',
        title: s.series?.title ?? '',
        slug: s.series?.slug ?? '',
        description: s.series?.description,
        status: fromApiSeriesStatus(s.series?.status),
        featuredImageUrl: s.series?.featuredImageAsset?.url ?? null,
        ogImageUrl: s.series?.ogAsset?.url ?? null,
        sourceLocale: s.series?.sourceLocale ?? '',
        postCount: s.postCount,
        managerCount: s.managerCount,
        createdAt: s.series?.createdAt ? timestampDate(s.series.createdAt) : undefined,
        updatedAt: s.series?.updatedAt ? timestampDate(s.series.updatedAt) : undefined,
      })),
      total,
      page: input.page ?? 1,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListSeriesAdmin RPC error', { error: err.message });
    }
    throw err;
  }
}

// Simple list for selectors (Server Component)
export async function listSeriesSimple() {
  try {
    const client = await createSeriesClient();
    const response = await client.listSeriesSimple({});
    return (response.series ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      slug: s.slug,
    }));
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListSeriesSimple RPC error', { error: err.message });
    }
    return [];
  }
}

export async function listPublicSeriesOptions() {
  try {
    const client = await createPublicSeriesClientWithAuth();
    const results = [];
    const seenIds = new Set<string>();
    const seenOffsets = new Set<number>();
    const limit = 100;
    let offset = 0;

    while (!seenOffsets.has(offset)) {
      seenOffsets.add(offset);
      const response = await client.list({
        pagination: { limit, offset },
        sorts: [{ field: 'title', order: SortOrder.ASC }],
      });
      const page = response.series ?? [];
      for (const series of page) {
        if (!series.id || seenIds.has(series.id)) {
          continue;
        }
        seenIds.add(series.id);
        results.push({
          id: series.id,
          title: series.title,
          slug: series.slug,
        });
      }

      if (!response.pagination?.hasMore) {
        return results;
      }
      if (page.length === 0) {
        throw new Error('List public Series returned an empty page with more results');
      }
      const pageOffset = response.pagination.offset;
      const pageLimit = response.pagination.limit > 0 ? response.pagination.limit : page.length;
      const nextOffset = pageOffset + pageLimit;
      const total = response.pagination.total;
      if (pageOffset !== offset || pageLimit <= 0 || nextOffset <= offset || seenOffsets.has(nextOffset)) {
        throw new Error('List public Series pagination did not advance');
      }
      if (total <= 0 || nextOffset >= total) {
        throw new Error('List public Series pagination exceeded its declared total');
      }
      offset = nextOffset;
    }

    throw new Error('List public Series pagination repeated an offset');
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListPublicSeriesOptions RPC error', { error: err.message });
    }
    throw err;
  }
}

export async function getPublicSeries(idOrSlug: string, options?: { requestedLocale?: string | null }) {
  try {
    const client = await createPublicSeriesClientWithAuth(options?.requestedLocale);
    const response = await client.get({ slug: decodeURIComponent(idOrSlug) });
    const series = response.series;
    if (!series) {
      return null;
    }

    return {
      id: series.id,
      title: series.title,
      slug: series.slug,
      description: series.description ?? null,
      postCount: series.postCount,
      featuredImageUrl: series.featuredImageAsset?.url ?? null,
      ogImageUrl: series.ogAsset?.url ?? null,
      localizationInfo: mapPublicLocalizationInfo(series.localizationInfo),
    };
  } catch (error) {
    if (isConnectErrorCode(error, Code.NotFound)) {
      return null;
    }
    throw error;
  }
}

// Get series with members (Server Component - for admin detail page)
export async function getSeriesWithManagers(id: string) {
  try {
    const client = await createSeriesClient();
    const response = await client.getSeriesWithManagers({ id });
    return {
      series: response.series
        ? {
            id: response.series.id,
            title: response.series.title,
            slug: response.series.slug ?? '',
            description: response.series.description,
            status: fromApiSeriesStatus(response.series.status),
            featuredImageUrl: response.series.featuredImageAsset?.url ?? null,
            ogImageUrl: response.series.ogAsset?.url ?? null,
            sourceLocale: response.series.sourceLocale,
            createdAt: response.series.createdAt ? timestampDate(response.series.createdAt) : undefined,
            updatedAt: response.series.updatedAt ? timestampDate(response.series.updatedAt) : undefined,
          }
        : null,
      managers: (response.managers ?? []).map((manager) => ({
        memberId: manager.memberId,
        nickname: manager.nickname,
        avatarUrl: manager.avatarAsset?.url ?? null,
        createdAt: manager.createdAt ? timestampDate(manager.createdAt) : undefined,
      })),
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    throw err;
  }
}

// User's series list (Server Component)
export async function listMySeries() {
  try {
    const client = await createSeriesClient();
    const results = [];
    const seenIds = new Set<string>();
    const seenOffsets = new Set<number>();
    const limit = 100;
    let offset = 0;

    while (!seenOffsets.has(offset)) {
      seenOffsets.add(offset);
      const response = await client.listMySeries({ pagination: { limit, offset } });
      const page = response.series ?? [];
      for (const item of page) {
        const id = item.series?.id ?? '';
        if (!id || seenIds.has(id)) {
          continue;
        }
        seenIds.add(id);
        results.push({
          id,
          title: item.series?.title ?? '',
          slug: item.series?.slug ?? '',
          status: fromApiSeriesStatus(item.series?.status),
          featuredImageUrl: item.series?.featuredImageAsset?.url ?? null,
          ogImageUrl: item.series?.ogAsset?.url ?? null,
          sourceLocale: item.series?.sourceLocale ?? '',
          postCount: item.postCount,
          managerCount: item.managerCount,
        });
      }

      if (!response.pagination?.hasMore) {
        return results;
      }
      if (page.length === 0) {
        throw new Error('ListMySeries returned an empty page with more results');
      }
      const pageOffset = response.pagination.offset;
      const pageLimit = response.pagination.limit > 0 ? response.pagination.limit : page.length;
      const nextOffset = pageOffset + pageLimit;
      const total = response.pagination.total;
      if (pageOffset !== offset || pageLimit <= 0 || nextOffset <= offset || seenOffsets.has(nextOffset)) {
        throw new Error('ListMySeries pagination did not advance');
      }
      if (total <= 0 || nextOffset >= total) {
        throw new Error('ListMySeries pagination exceeded its declared total');
      }
      offset = nextOffset;
    }

    throw new Error('ListMySeries pagination repeated an offset');
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListMySeries RPC error', { error: err.message });
    }
    throw err;
  }
}
