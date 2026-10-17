import { Suspense } from 'react';
import { listPublishedReleases } from '@/lib/queries/release';
import { parseBooleanProp, parseIntegerProp, splitCsv } from '../list-shared';
import type { BlockViewProps } from '../types';
import { parseReleaseListProps } from './schema';
import { ReleaseListSkeleton } from './Skeleton';
import { ReleaseListViewClient } from './ViewClient';
import { ReleaseInfiniteList } from './InfiniteList';
import { toReleaseListItem } from './transform';

async function ReleaseListViewServer({ props, requestedLocale }: BlockViewProps) {
  const p = parseReleaseListProps(props);
  const categoryIds = splitCsv(p.categoryIds);
  const limit = parseIntegerProp(p.limit, 8);
  // Pagination continues the list in place: the first page renders here, later pages on demand.
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
    requestedLocale,
  };

  const { releases, pagination } = await listPublishedReleases({ ...query, offset: 0 });
  const items = releases.map(toReleaseListItem);

  return showPagination ? (
    <ReleaseInfiniteList initialReleases={items} total={pagination.total} query={query} parsedProps={p} />
  ) : (
    <ReleaseListViewClient releases={items} parsedProps={p} />
  );
}

export function ReleaseListViewStreaming(blockProps: BlockViewProps) {
  const { props } = blockProps;
  const p = parseReleaseListProps(props);
  const columns = parseIntegerProp(p.columns, 4);
  const limit = parseIntegerProp(p.limit, 8);
  const layout = p.layout || 'grid';
  const carouselLoop = p.carouselLoop !== 'false';
  const carouselIndicators = p.carouselIndicators !== 'false';

  return (
    <Suspense
      fallback={
        <ReleaseListSkeleton
          columns={columns}
          limit={limit}
          layout={layout}
          itemSize={p.itemSize}
          showImage={p.showImage !== 'false'}
          imageAspectRatio={p.imageAspectRatio}
          carouselLoop={carouselLoop}
          carouselIndicators={carouselIndicators}
        />
      }
    >
      <ReleaseListViewServer {...blockProps} />
    </Suspense>
  );
}
