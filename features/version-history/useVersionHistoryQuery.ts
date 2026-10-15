'use client';

import { useCallback, useMemo } from 'react';
import { useInfiniteQuery, type FetchNextPageOptions } from '@tanstack/react-query';
import { listVersionsRequest } from '@/lib/client/version-history';
import type { VersionedEntityType, VersionInfo, VersionListResult } from '@/lib/types/version-history';

const PAGE_SIZE = 20;

function nextVersionPage(result: VersionListResult, requestedPage: number): number | undefined {
  const count = result.versions?.length ?? 0;
  if (count === 0) {
    return undefined;
  }
  if (result.total !== undefined) {
    return requestedPage * PAGE_SIZE < result.total ? requestedPage + 1 : undefined;
  }
  return count === PAGE_SIZE ? requestedPage + 1 : undefined;
}

export function useVersionHistoryQuery({
  entityType,
  entityId,
  opened,
}: {
  entityType: VersionedEntityType;
  entityId: string;
  opened: boolean;
}) {
  const query = useInfiniteQuery({
    queryKey: ['version-history', entityType, entityId],
    enabled: opened,
    retry: false,
    queryFn: async ({ pageParam, signal }) => {
      const result = await listVersionsRequest(entityType, entityId, pageParam, PAGE_SIZE, signal);
      if (result.error) {
        throw new Error(result.error);
      }
      return result;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, _pages, lastPageParam) => nextVersionPage(lastPage, lastPageParam),
  });
  const versions = useMemo(() => {
    const loaded: VersionInfo[] = [];
    const ids = new Set<string>();
    for (const page of query.data?.pages ?? []) {
      for (const version of page.versions ?? []) {
        if (!ids.has(version.id)) {
          ids.add(version.id);
          loaded.push(version);
        }
      }
    }
    return loaded;
  }, [query.data?.pages]);
  const { fetchNextPage: queryFetchNextPage } = query;
  const fetchNextPage = useCallback(
    (options?: FetchNextPageOptions) => queryFetchNextPage({ cancelRefetch: false, ...options }),
    [queryFetchNextPage],
  );
  const lastPage = query.data?.pages.at(-1);
  const lastPageParam = query.data?.pageParams.at(-1);
  const nextPage =
    lastPage && typeof lastPageParam === 'number' ? (nextVersionPage(lastPage, lastPageParam) ?? null) : null;

  return { ...query, fetchNextPage, versions, nextPage };
}
