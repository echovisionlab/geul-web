'use client';

import { useCallback } from 'react';
import { InfiniteItems } from '../infinite-items';
import type { PostListProps } from './schema';
import { toPostListItem, type postListQuery } from './transform';
import { PostListViewClient } from './ViewClient';
import type { PostListViewClientProps } from './ViewClientRuntime';

type Item = PostListViewClientProps['posts'][number];

/** Server-rendered first page; further pages load on the client through the public query, on demand. */
export function PostInfiniteList({
  initialPosts,
  total,
  query,
  parsedProps,
}: {
  initialPosts: Item[];
  total: number;
  query: ReturnType<typeof postListQuery>;
  parsedProps: PostListProps;
}) {
  const loadPage = useCallback(
    async (offset: number) => {
      const { listPublishedPosts } = await import('@/lib/queries/post-browser');
      const { posts } = await listPublishedPosts({ ...query, offset });
      return posts.map(toPostListItem);
    },
    [query],
  );
  return (
    <InfiniteItems initialItems={initialPosts} total={total} loadPage={loadPage}>
      {(posts) => <PostListViewClient posts={[...posts]} parsedProps={parsedProps} />}
    </InfiniteItems>
  );
}
