'use client';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useQuery } from '@tanstack/react-query';

import { listLabelsForBlockAction } from '@/lib/actions/label';
import { parseBooleanProp, parseIntegerProp } from '../list-view-utils';
import { ListBlockSkeleton } from '../ListBlockSkeleton';
import type { BlockViewProps } from '../types';
import { parseLabelListProps } from './schema';
import { LabelListViewClient } from './ViewClient';
import { LabelInfiniteList } from './InfiniteList';
import { toLabelListItem } from './transform';

export function LabelListView({ props }: BlockViewProps) {
  const p = parseLabelListProps(props);
  const limit = parseIntegerProp(p.limit, 12);
  const columns = parseIntegerProp(p.columns, 3);
  const showPagination = parseBooleanProp(p.showPagination, false);
  const query = { sortBy: p.sortBy || 'name', sortOrder: p.sortOrder || 'asc', limit };

  const labelsQuery = useQuery({
    queryKey: ['labels', 'forBlock', { ...query, offset: 0 }],
    queryFn: () => listLabelsForBlockAction({ ...query, offset: 0 }).then(unwrapQueryResult),
  });
  const { data, isLoading } = labelsQuery;

  if (labelsQuery.isError && labelsQuery.data === undefined) {
    return <QueryErrorAlert queries={[labelsQuery]} />;
  }
  if (isLoading || !data) {
    return (
      <ListBlockSkeleton
        className="label-list-block"
        columns={columns}
        limit={Math.min(limit, 12)}
        layout={p.layout}
        itemSize={p.itemSize}
        showImage={p.showImage !== 'false'}
        imageAspectRatio={p.imageAspectRatio}
        carouselLoop={p.carouselLoop !== 'false'}
        carouselIndicators={p.carouselIndicators !== 'false'}
      />
    );
  }

  const items = data.labels.map(toLabelListItem);
  return (
    <>
      <QueryErrorAlert queries={[labelsQuery]} />
      {showPagination ? (
        <LabelInfiniteList
          key={JSON.stringify(query)}
          initialLabels={items}
          total={data.pagination.total}
          query={query}
          parsedProps={p}
        />
      ) : (
        <LabelListViewClient labels={items} parsedProps={p} />
      )}
    </>
  );
}
