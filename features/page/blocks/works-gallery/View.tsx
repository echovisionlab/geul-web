'use client';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useQuery } from '@tanstack/react-query';

import { listWorksPublishedAction } from '@/lib/actions/work';
import { parseBooleanProp, parseIntegerProp, splitCsv } from '../list-view-utils';
import { ListBlockSkeleton } from '../ListBlockSkeleton';
import type { BlockViewProps } from '../types';
import { parseWorkListProps } from './schema';
import { WorkListViewClient } from './ViewClient';
import { WorkInfiniteList } from './InfiniteList';
import { toWorkListItem } from './transform';

export function WorkListView({ props }: BlockViewProps) {
  const p = parseWorkListProps(props);
  const columns = parseIntegerProp(p.columns, 3);
  const limit = parseIntegerProp(p.limit, 6);
  const workTypes = splitCsv(p.workTypes) as Array<'music_project' | 'portfolio' | 'article' | 'contribution'>;
  const showPagination = parseBooleanProp(p.showPagination, false);
  const query = {
    types: workTypes.length > 0 ? workTypes : undefined,
    featured: p.featuredOnly === 'true' ? true : undefined,
    limit,
    sortBy: p.sortBy,
    sortOrder: p.sortOrder,
  };

  const worksQuery = useQuery({
    queryKey: ['works', 'published', { ...query, offset: 0 }],
    queryFn: () => listWorksPublishedAction({ ...query, offset: 0 }).then(unwrapQueryResult),
  });
  const { data, isLoading } = worksQuery;

  if (worksQuery.isError && worksQuery.data === undefined) {
    return <QueryErrorAlert queries={[worksQuery]} />;
  }
  if (isLoading || !data) {
    return (
      <ListBlockSkeleton
        className="work-list-block"
        columns={columns}
        limit={limit}
        layout={p.layout}
        itemSize={p.itemSize}
        showImage={p.showImage !== 'false'}
        imageAspectRatio={p.imageAspectRatio}
        carouselLoop={p.carouselLoop !== 'false'}
        carouselIndicators={p.carouselIndicators !== 'false'}
      />
    );
  }

  const items = data.works.map(toWorkListItem);
  return (
    <>
      <QueryErrorAlert queries={[worksQuery]} />
      {showPagination ? (
        <WorkInfiniteList
          key={JSON.stringify(query)}
          initialWorks={items}
          total={data.pagination.total}
          query={query}
          parsedProps={p}
        />
      ) : (
        <WorkListViewClient works={items} parsedProps={p} />
      )}
    </>
  );
}
