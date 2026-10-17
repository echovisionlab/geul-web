import { unwrapQueryResult } from '@/lib/api/query-result';
import { Suspense } from 'react';
import { listLabelsForBlockAction } from '@/lib/actions/label';
import { parseBooleanProp, parseIntegerProp } from '../list-shared';
import type { BlockViewProps } from '../types';
import { parseLabelListProps } from './schema';
import { LabelListSkeleton } from './Skeleton';
import { LabelListViewClient } from './ViewClient';
import { LabelInfiniteList } from './InfiniteList';
import { toLabelListItem } from './transform';

async function LabelListViewServer({ props, requestedLocale }: BlockViewProps) {
  const p = parseLabelListProps(props);
  const limit = parseIntegerProp(p.limit, 12);
  // Pagination continues the list in place: the first page renders here, later pages on demand.
  const showPagination = parseBooleanProp(p.showPagination, false);
  const query = { sortBy: p.sortBy, sortOrder: p.sortOrder, limit };
  const { labels, pagination } = await listLabelsForBlockAction({ ...query, offset: 0, requestedLocale }).then(
    unwrapQueryResult,
  );
  const items = labels.map(toLabelListItem);

  return showPagination ? (
    <LabelInfiniteList
      initialLabels={items}
      total={pagination.total}
      query={query}
      parsedProps={p}
      locale={requestedLocale}
    />
  ) : (
    <LabelListViewClient labels={items} parsedProps={p} />
  );
}

export function LabelListViewStreaming(blockProps: BlockViewProps) {
  const { props } = blockProps;
  const p = parseLabelListProps(props);
  const columns = parseIntegerProp(p.columns, 3);
  const limit = parseIntegerProp(p.limit, 12);

  return (
    <Suspense
      fallback={
        <LabelListSkeleton
          columns={columns}
          limit={limit}
          layout={p.layout}
          itemSize={p.itemSize}
          showImage={p.showImage !== 'false'}
          imageAspectRatio={p.imageAspectRatio}
          carouselLoop={p.carouselLoop !== 'false'}
          carouselIndicators={p.carouselIndicators !== 'false'}
        />
      }
    >
      <LabelListViewServer {...blockProps} />
    </Suspense>
  );
}
