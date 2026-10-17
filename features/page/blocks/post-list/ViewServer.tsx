import { Suspense } from 'react';
import { listPublishedPosts } from '@/lib/queries/post';
import type { BlockViewProps } from '../types';
import { parsePostListProps } from './schema';
import { PostListSkeleton } from './Skeleton';
import { PostListViewClient } from './ViewClient';
import { PostInfiniteList } from './InfiniteList';
import { postListQuery, toPostListItem } from './transform';

async function PostListViewServer({ props, requestedLocale }: BlockViewProps) {
  const p = parsePostListProps(props);
  const query = postListQuery(p);
  // Pagination continues the list in place: the first page renders here, later pages on demand.
  const showPagination = p.showPagination === 'true';
  const { posts, pagination } = await listPublishedPosts({ ...query, offset: 0, requestedLocale });
  const items = posts.map(toPostListItem);

  return showPagination ? (
    <PostInfiniteList initialPosts={items} total={pagination.total} query={query} parsedProps={p} />
  ) : (
    <PostListViewClient posts={items} parsedProps={p} />
  );
}

export function PostListViewStreaming(blockProps: BlockViewProps) {
  const { props } = blockProps;
  const p = parsePostListProps(props);
  const columns = parseInt(p.columns || '3', 10);
  const limit = parseInt(p.limit || '6', 10);
  const layout = p.layout || 'grid';
  const carouselLoop = p.carouselLoop !== 'false';
  const carouselIndicators = p.carouselIndicators !== 'false';

  return (
    <Suspense
      fallback={
        <PostListSkeleton
          columns={columns}
          limit={limit}
          layout={layout}
          itemSize={p.itemSize}
          showImage={p.showFeaturedImage !== 'false'}
          imageAspectRatio={p.imageAspectRatio}
          carouselLoop={carouselLoop}
          carouselIndicators={carouselIndicators}
        />
      }
    >
      <PostListViewServer {...blockProps} />
    </Suspense>
  );
}
