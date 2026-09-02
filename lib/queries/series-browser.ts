import { isConnectError } from '@/lib/api/connect-error';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { createSeriesClient } from '@/lib/api/browser-client';
import { searchMembers } from '@/lib/queries/user-browser';
import { fromApiSeriesStatus } from '@/lib/types/series/status';
import { createClientLogger } from '@/lib/utils/client-logger';

const logger = createClientLogger('series-browser');

// ============================================
// Client Component queries for Series domain
// ============================================

function fromApiPostStatus(status: string | null | undefined): 'draft' | 'published' | 'archived' {
  if (!status) {
    return 'draft';
  }
  if (status === 'POST_STATUS_DRAFT' || status.toLowerCase() === 'draft') {
    return 'draft';
  }
  if (status === 'POST_STATUS_PUBLISHED' || status.toLowerCase() === 'published') {
    return 'published';
  }
  if (status === 'POST_STATUS_ARCHIVED' || status.toLowerCase() === 'archived') {
    return 'archived';
  }
  return 'draft';
}

export async function listSeriesManagers(seriesId: string) {
  try {
    const client = createSeriesClient();
    const response = await client.listSeriesManagers({ seriesId });
    return (response.managers ?? []).map((manager) => ({
      memberId: manager.memberId,
      nickname: manager.nickname,
      avatarUrl: manager.avatarAsset?.url,
      createdAt: manager.createdAt ? timestampDate(manager.createdAt) : undefined,
    }));
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListSeriesManagers RPC error', { error: err.message });
    }
    throw err;
  }
}

export async function searchSeriesManagerCandidates(query: string, excludeIds: string[] = []) {
  const results = await searchMembers(query, excludeIds);
  return results.map((u) => ({
    id: u.id,
    nickname: u.nickname,
    avatarUrl: u.avatarUrl,
  }));
}

// Simple list for selectors
export async function listSeriesSimple() {
  try {
    const client = createSeriesClient();
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
    throw err;
  }
}

// User's series list
export async function listMySeries() {
  try {
    const client = createSeriesClient();
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

export async function listSeriesPosts(seriesId: string) {
  try {
    const client = createSeriesClient();
    const response = await client.listSeriesPosts({ seriesId });
    return (response.posts ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: fromApiPostStatus(p.status),
      seriesOrder: p.seriesOrder,
      publishedAt: p.publishedAt ? timestampDate(p.publishedAt) : undefined,
    }));
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListSeriesPosts RPC error', { error: err.message });
    }
    throw err;
  }
}

export async function checkSeriesSlugAvailable(
  slug: string,
  excludeSeriesId?: string,
): Promise<{ available: boolean }> {
  try {
    const client = createSeriesClient();
    const response = await client.checkSeriesSlugAvailable({
      slug,
      excludeId: excludeSeriesId,
    });
    return { available: response.available };
  } catch {
    return { available: false };
  }
}
