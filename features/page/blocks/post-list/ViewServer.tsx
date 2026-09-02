import { Suspense } from 'react';
import { ServerDataTablePagination } from '@/features/data-table/ServerDataTable/ServerDataTablePagination';
import { listPublishedPosts } from '@/lib/queries/post';
import { buildBlockTableNamespace, parseBlockTableQuery, queryRecordToSearchParams } from '../table-utils';
import type { BlockViewProps } from '../types';
import { parsePostListProps } from './schema';
import { PostListSkeleton } from './Skeleton';
import { PostListViewClient } from './ViewClient';

async function PostListViewServer({ sectionId, props, query, requestedLocale }: BlockViewProps) {
  const p = parsePostListProps(props);

  const categoryIds = p.categoryIds ? p.categoryIds.split(',').filter(Boolean) : undefined;
  const tagIds = p.tagIds ? p.tagIds.split(',').filter(Boolean) : undefined;
  const authorIds = p.authorIds ? p.authorIds.split(',').filter(Boolean) : undefined;
  const seriesId = p.seriesId || undefined;
  const sortBy = (p.sortBy as 'published_at' | 'updated_at' | 'title') || 'published_at';
  const sortOrder = (p.sortOrder as 'asc' | 'desc') || 'desc';
  const limit = parseInt(p.limit || '6', 10);
  const showPagination = p.showPagination === 'true';
  const namespace = buildBlockTableNamespace('postList', sectionId);
  const searchParams = queryRecordToSearchParams(query);
  const tableQuery = showPagination
    ? parseBlockTableQuery(searchParams, namespace, limit)
    : { page: 1, pageSize: limit };

  const { posts, pagination } = await listPublishedPosts({
    categoryIds,
    tagIds,
    authorIds,
    seriesId,
    sortBy,
    sortOrder,
    limit: tableQuery.pageSize,
    offset: ((tableQuery.page ?? 1) - 1) * (tableQuery.pageSize ?? limit),
    requestedLocale,
  });

  // Serialize dates for client component (Date -> ISO string)
  // Transform to format expected by ViewClient (snake_case)
  const serializedPosts = posts.map((post) => ({
    id: post.id,
    slug: post.slug ?? null,
    title: post.title,
    featured_image_url: post.featured_image_url ?? null,
    published_at: post.published_at?.toISOString() ?? null,
    authors: post.authors.map((a) => ({
      id: a.id,
      name: a.name,
      image: a.avatar_url ?? null,
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
  }));

  const result = {
    data: serializedPosts,
    total: pagination.total,
    page: tableQuery.page ?? 1,
    pageSize: tableQuery.pageSize ?? limit,
    totalPages: Math.ceil(pagination.total / (tableQuery.pageSize ?? limit)),
  };

  return (
    <>
      <PostListViewClient posts={serializedPosts} parsedProps={p} />
      {showPagination ? (
        <ServerDataTablePagination namespace={namespace} result={result} searchParams={searchParams} />
      ) : null}
    </>
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
          carouselLoop={carouselLoop}
          carouselIndicators={carouselIndicators}
        />
      }
    >
      <PostListViewServer {...blockProps} />
    </Suspense>
  );
}
