import { Suspense } from 'react';
import { listWorksForGallery } from '@/lib/queries/work';
import { parseBooleanProp, parseIntegerProp, splitCsv } from '../list-shared';
import type { BlockViewProps } from '../types';
import { parseWorkListProps } from './schema';
import { WorkListSkeleton } from './Skeleton';
import { WorkListViewClient } from './ViewClient';
import { WorkInfiniteList } from './InfiniteList';
import { toWorkListItem } from './transform';

async function WorkListViewServer({ props, requestedLocale }: BlockViewProps) {
  const p = parseWorkListProps(props);
  const limit = parseIntegerProp(p.limit, 6);
  // Pagination continues the list in place: the first page renders here, later pages on demand.
  const showPagination = parseBooleanProp(p.showPagination, false);
  const workTypes = splitCsv(p.workTypes) as Array<'music_project' | 'portfolio' | 'article' | 'contribution'>;
  const types = workTypes.length > 0 ? workTypes : undefined;

  const { works, pagination } = await listWorksForGallery({
    types,
    featuredOnly: p.featuredOnly === 'true',
    limit,
    offset: 0,
    sortBy: p.sortBy,
    sortOrder: p.sortOrder,
    requestedLocale,
  });
  const items = works.map(toWorkListItem);

  return showPagination ? (
    <WorkInfiniteList
      initialWorks={items}
      total={pagination.total}
      query={{
        types,
        featured: p.featuredOnly === 'true' ? true : undefined,
        limit,
        sortBy: p.sortBy,
        sortOrder: p.sortOrder,
      }}
      parsedProps={p}
    />
  ) : (
    <WorkListViewClient works={items} parsedProps={p} />
  );
}

export function WorkListViewStreaming(blockProps: BlockViewProps) {
  const { props } = blockProps;
  const p = parseWorkListProps(props);
  const columns = parseIntegerProp(p.columns, 3);
  const limit = parseIntegerProp(p.limit, 6);
  const layout = p.layout || 'grid';
  const carouselLoop = p.carouselLoop !== 'false';
  const carouselIndicators = p.carouselIndicators !== 'false';

  return (
    <Suspense
      fallback={
        <WorkListSkeleton
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
      <WorkListViewServer {...blockProps} />
    </Suspense>
  );
}
