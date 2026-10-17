'use client';

import { useCallback } from 'react';
import { listLabelsForBlockAction } from '@/lib/actions/label';
import { unwrapQueryResult } from '@/lib/api/query-result';
import { InfiniteItems } from '../infinite-items';
import type { LabelListProps } from './schema';
import { toLabelListItem } from './transform';
import { LabelListViewClient } from './ViewClient';
import type { LabelListViewClientProps } from './ViewClientRuntime';

type Item = LabelListViewClientProps['labels'][number];
type ActionQuery = Omit<Parameters<typeof listLabelsForBlockAction>[0], 'offset' | 'requestedLocale'>;

/** Server-rendered first page; further pages load through the public labels action, on demand. */
export function LabelInfiniteList({
  initialLabels,
  total,
  query,
  parsedProps,
  locale,
}: {
  initialLabels: Item[];
  total: number;
  query: ActionQuery;
  parsedProps: LabelListProps;
  locale?: string;
}) {
  const loadPage = useCallback(
    async (offset: number) => {
      const { labels } = unwrapQueryResult(
        await listLabelsForBlockAction({ ...query, offset, requestedLocale: locale }),
      );
      return labels.map(toLabelListItem);
    },
    [query, locale],
  );
  return (
    <InfiniteItems initialItems={initialLabels} total={total} loadPage={loadPage}>
      {(labels) => <LabelListViewClient labels={[...labels]} parsedProps={parsedProps} />}
    </InfiniteItems>
  );
}
