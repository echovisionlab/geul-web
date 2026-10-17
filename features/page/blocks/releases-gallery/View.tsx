'use client';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { useQuery } from '@tanstack/react-query';

import { listPublishedReleases } from '@/lib/queries/release-browser';
import { parseBooleanProp, parseIntegerProp, splitCsv } from '../list-view-utils';
import { ListBlockSkeleton } from '../ListBlockSkeleton';
import type { BlockViewProps } from '../types';
import { parseReleaseListProps } from './schema';
import { ReleaseListViewClient } from './ViewClient';
import { ReleaseInfiniteList } from './InfiniteList';
import { toReleaseListItem } from './transform';

export function ReleaseListView({ props }: BlockViewProps) {
  const p = parseReleaseListProps(props);
  const columns = parseIntegerProp(p.columns, 4);
  const limit = parseIntegerProp(p.limit, 8);
  const categoryIds = splitCsv(p.categoryIds);
  const showPagination = parseBooleanProp(p.showPagination, false);
  const types = splitCsv(p.types) as Array<'album' | 'ep' | 'single' | 'compilation'>;
  const query = {
    types: types.length > 0 ? types : undefined,
    categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
    artistId: p.artistId || undefined,
    labelId: p.labelId || undefined,
    limit,
    sortBy: p.sortBy,
    sortOrder: p.sortOrder,
  };
  const loadedDataQuery = useQuery({
    queryKey: ['releases', 'published', { ...query, offset: 0 }],
    queryFn: () => listPublishedReleases({ ...query, offset: 0 }),
  });
  const { data, isLoading } = loadedDataQuery;
  if (loadedDataQuery.isError && loadedDataQuery.data === undefined) {
    return <QueryErrorAlert queries={[loadedDataQuery]} />;
  }
  if (isLoading || !data) {
    return (
      <ListBlockSkeleton
        className="release-list-block"
        columns={columns}
        limit={limit}
        layout={p.layout}
        itemSize={p.itemSize}
        showImage={p.showImage !== 'false'}
        imageAspectRatio={p.imageAspectRatio}
        carouselLoop={p.carouselLoop !== 'false'}
        carouselIndicators={p.carouselIndicators !== 'false'}
        trackScale="compact"
      />
    );
  }
  const items = data.releases.map(toReleaseListItem);
  return (
    <>
      <QueryErrorAlert queries={[loadedDataQuery]} />
      {showPagination ? (
        <ReleaseInfiniteList
          key={JSON.stringify(query)}
          initialReleases={items}
          total={data.pagination.total}
          query={query}
          parsedProps={p}
        />
      ) : (
        <ReleaseListViewClient releases={items} parsedProps={p} />
      )}
    </>
  );
}
