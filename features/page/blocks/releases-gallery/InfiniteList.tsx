'use client';

import { useCallback } from 'react';
import { InfiniteItems } from '../infinite-items';
import type { ReleaseListProps } from './schema';
import { toReleaseListItem } from './transform';
import { ReleaseListViewClient } from './ViewClient';
import type { ReleaseListViewClientProps } from './ViewClientRuntime';

type Item = ReleaseListViewClientProps['releases'][number];
type BrowserQuery = Omit<Parameters<typeof import('@/lib/queries/release-browser').listPublishedReleases>[0], 'offset'>;

/** Server-rendered first page; further pages load on the client through the public query, on demand. */
export function ReleaseInfiniteList({
  initialReleases,
  total,
  query,
  parsedProps,
}: {
  initialReleases: Item[];
  total: number;
  query: BrowserQuery;
  parsedProps: ReleaseListProps;
}) {
  const loadPage = useCallback(
    async (offset: number) => {
      const { listPublishedReleases } = await import('@/lib/queries/release-browser');
      const { releases } = await listPublishedReleases({ ...query, offset });
      return releases.map(toReleaseListItem);
    },
    [query],
  );
  return (
    <InfiniteItems initialItems={initialReleases} total={total} loadPage={loadPage}>
      {(releases) => <ReleaseListViewClient releases={[...releases]} parsedProps={parsedProps} />}
    </InfiniteItems>
  );
}
