'use client';
import { SupportingText } from '@/components/core/Typography';
import { LayoutInset as DsLayoutInset, LayoutInline as DsLayoutInline } from '@/components/core/Layout';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pagination } from '@/components/core/Display';
import { listPublishedPosts } from '@/lib/queries/post-browser';
import type { BlockViewProps } from '../types';
import { parsePostListProps } from './schema';
import { PostListViewClient } from './ViewClient';
import { PostListSkeleton } from './Skeleton';
export function PostListView({ props }: BlockViewProps) {
  const tPagination = useTranslations('dataTable.pagination');
  const p = parsePostListProps(props);
  // Parse durable props stored as strings
  const categoryIds = p.categoryIds ? p.categoryIds.split(',').filter(Boolean) : undefined;
  const tagIds = p.tagIds ? p.tagIds.split(',').filter(Boolean) : undefined;
  const authorIds = p.authorIds ? p.authorIds.split(',').filter(Boolean) : undefined;
  const seriesId = p.seriesId || undefined;
  const sortBy = (p.sortBy as 'published_at' | 'updated_at' | 'title') || 'published_at';
  const sortOrder = (p.sortOrder as 'asc' | 'desc') || 'desc';
  const limit = parseInt(p.limit || '6', 10);
  const layout = p.layout || 'grid';
  const columns = parseInt(p.columns || '3', 10);
  const showPagination = p.showPagination === 'true';
  const carouselLoop = p.carouselLoop !== 'false';
  const carouselIndicators = p.carouselIndicators !== 'false';
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: [
      'posts',
      'published',
      { categoryIds, tagIds, authorIds, seriesId, sortBy, sortOrder, limit, page, showPagination },
    ],
    queryFn: () =>
      listPublishedPosts({
        categoryIds,
        tagIds,
        authorIds,
        seriesId,
        sortBy,
        sortOrder,
        limit: showPagination ? limit : limit,
        offset: showPagination ? (page - 1) * limit : 0,
      }),
  });
  if (isLoading) {
    return (
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
    );
  }
  if (!data?.posts?.length) {
    return (
      <div className="post-list-block">
        <DsLayoutInset block="xl">
          <SupportingText tone="secondary" align="center">
            No posts found
          </SupportingText>
        </DsLayoutInset>
      </div>
    );
  }
  const content = (
    <PostListViewClient
      posts={data.posts.map((post) => ({
        id: post.id,
        slug: post.slug ?? null,
        title: post.title,
        featured_image_url: post.featured_image_url ?? null,
        published_at: post.published_at?.toISOString() ?? null,
        authors: post.authors.map((author) => ({
          id: author.id,
          name: author.name,
          image: author.avatar_url ?? null,
        })),
        categories: post.categories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug ?? null,
        })),
        tags: post.tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          slug: tag.slug ?? null,
        })),
      }))}
      parsedProps={p}
    />
  );
  return (
    <>
      {content}
      {showPagination && data.pagination.total > limit ? (
        <DsLayoutInset blockStart="md">
          <DsLayoutInline justify="center">
            <Pagination
              total={Math.ceil(data.pagination.total / limit)}
              value={page}
              onChange={setPage}
              labels={{
                previousPage: tPagination('previousPage'),
                nextPage: tPagination('nextPage'),
                page: (page) => tPagination('page', { page }),
              }}
            />
          </DsLayoutInline>
        </DsLayoutInset>
      ) : null}
    </>
  );
}
