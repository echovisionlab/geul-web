'use client';
import { SupportingText } from '@/components/core/Typography';
import { LayoutInset as DsLayoutInset } from '@/components/core/Layout';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { listPublishedPosts } from '@/lib/queries/post-browser';
import type { BlockViewProps } from '../types';
import { parsePostListProps } from './schema';
import { PostListViewClient } from './ViewClient';
import { PostInfiniteList } from './InfiniteList';
import { postListQuery, toPostListItem } from './transform';
import { PostListSkeleton } from './Skeleton';
export function PostListView({ props }: BlockViewProps) {
  const tMessages = useTranslations('common.messages');
  const p = parsePostListProps(props);
  const query = postListQuery(p);
  const layout = p.layout || 'grid';
  const columns = parseInt(p.columns || '3', 10);
  const showPagination = p.showPagination === 'true';
  const { data, isLoading } = useQuery({
    queryKey: ['posts', 'published', { ...query, offset: 0 }],
    queryFn: () => listPublishedPosts({ ...query, offset: 0 }),
  });
  if (isLoading) {
    return (
      <PostListSkeleton
        columns={columns}
        limit={query.limit}
        layout={layout}
        itemSize={p.itemSize}
        showImage={p.showFeaturedImage !== 'false'}
        imageAspectRatio={p.imageAspectRatio}
        carouselLoop={p.carouselLoop !== 'false'}
        carouselIndicators={p.carouselIndicators !== 'false'}
      />
    );
  }
  if (!data?.posts?.length) {
    return (
      <div className="post-list-block">
        <DsLayoutInset block="xl">
          <SupportingText tone="secondary" align="center">
            {tMessages('noPostsFound')}
          </SupportingText>
        </DsLayoutInset>
      </div>
    );
  }
  const items = data.posts.map(toPostListItem);
  return showPagination ? (
    <PostInfiniteList
      key={JSON.stringify(query)}
      initialPosts={items}
      total={data.pagination.total}
      query={query}
      parsedProps={p}
    />
  ) : (
    <PostListViewClient posts={items} parsedProps={p} />
  );
}
