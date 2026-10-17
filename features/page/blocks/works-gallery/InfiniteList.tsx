'use client';

import { useCallback } from 'react';
import { listWorksPublishedAction } from '@/lib/actions/work';
import { unwrapQueryResult } from '@/lib/api/query-result';
import { InfiniteItems } from '../infinite-items';
import type { WorkListProps } from './schema';
import { toWorkListItem } from './transform';
import { WorkListViewClient } from './ViewClient';
import type { WorkListViewClientProps } from './ViewClientRuntime';

type Item = WorkListViewClientProps['works'][number];
type ActionQuery = Omit<NonNullable<Parameters<typeof listWorksPublishedAction>[0]>, 'offset'>;

/** Server-rendered first page; further pages load through the public works action, on demand. */
export function WorkInfiniteList({
  initialWorks,
  total,
  query,
  parsedProps,
}: {
  initialWorks: Item[];
  total: number;
  query: ActionQuery;
  parsedProps: WorkListProps;
}) {
  const loadPage = useCallback(
    async (offset: number) => {
      const { works } = unwrapQueryResult(await listWorksPublishedAction({ ...query, offset }));
      return works.map(toWorkListItem);
    },
    [query],
  );
  return (
    <InfiniteItems initialItems={initialWorks} total={total} loadPage={loadPage}>
      {(works) => <WorkListViewClient works={[...works]} parsedProps={parsedProps} />}
    </InfiniteItems>
  );
}
