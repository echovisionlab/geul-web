import type { PaginatedQuery } from '@/lib/types/common/query';

/** First page of the public category/tag post listing. The server renders it; later queries run in the browser. */
export const TAXONOMY_POSTS_INITIAL_QUERY: PaginatedQuery = {
  page: 1,
  pageSize: 20,
  sorts: [{ field: 'published_at', direction: 'desc' }],
};
