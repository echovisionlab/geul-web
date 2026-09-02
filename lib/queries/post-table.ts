import { timestampDate, type Timestamp } from '@bufbuild/protobuf/wkt';
import { FilterOp } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { POST_TABLE_FILTER_FIELD_DEFINITIONS, POST_TABLE_SORT_FIELD_DEFINITIONS } from '@/lib/types/post/table-spec';
import type { PaginatedQuery } from '@/lib/types/common/query';
import {
  buildPublicTableRequest,
  type PublicTableFilterFieldSpec,
  type PublicTableSortFieldSpec,
} from './public-table';

export interface PublicPostTableRow {
  id: string;
  slug: string | null;
  title: string | null;
  summary: string | null;
  publishedAt: string | null;
  authors: { id: string; name: string | null; avatarUrl: string | null }[];
  categories: { id: string; name: string; slug: string | null }[];
  tags: { id: string; name: string; slug: string | null }[];
}

export interface PublishedPostsTableInput {
  query: PaginatedQuery;
  pageSize?: number;
  categoryIds?: string[];
  tagIds?: string[];
  authorIds?: string[];
  seriesId?: string;
  statuses?: string[];
  allowedFilterFields?: readonly PublicTableFilterFieldSpec[];
  allowedSortFields?: readonly PublicTableSortFieldSpec[];
  rejectInvalidQuery?: boolean;
}

export function buildPublishedPostsTableRequest(input: PublishedPostsTableInput) {
  return buildPublicTableRequest({
    query: input.query,
    defaultPageSize: input.pageSize ?? 10,
    allowedFilterFields: input.allowedFilterFields ?? POST_TABLE_FILTER_FIELD_DEFINITIONS,
    allowedSortFields: input.allowedSortFields ?? POST_TABLE_SORT_FIELD_DEFINITIONS,
    baseFilters: [
      ...(input.statuses?.length ? [{ field: 'status', op: FilterOp.IN, values: input.statuses }] : []),
      ...(input.categoryIds?.length ? [{ field: 'category_id', op: FilterOp.IN, values: input.categoryIds }] : []),
      ...(input.tagIds?.length ? [{ field: 'tag_id', op: FilterOp.IN, values: input.tagIds }] : []),
      ...(input.authorIds?.length ? [{ field: 'author_id', op: FilterOp.IN, values: input.authorIds }] : []),
      ...(input.seriesId ? [{ field: 'series_id', op: FilterOp.EQ, value: input.seriesId }] : []),
    ],
    rejectInvalidQuery: input.rejectInvalidQuery ?? false,
  });
}

interface PostTableSource {
  id: string;
  slug?: string;
  title?: string;
  summary?: string;
  publishedAt?: Timestamp;
  authorMembers: Array<{ id: string; nickname?: string; avatarAsset?: { url: string } }>;
  categories: Array<{ id: string; name: string; slug?: string }>;
  tags: Array<{ id: string; name: string; slug?: string }>;
}

export function mapPublicPostTableRow(post: PostTableSource): PublicPostTableRow {
  return {
    id: post.id,
    slug: post.slug ?? null,
    title: post.title ?? null,
    summary: post.summary ?? null,
    publishedAt: post.publishedAt ? timestampDate(post.publishedAt).toISOString() : null,
    authors: post.authorMembers.map((author) => ({
      id: author.id,
      name: author.nickname ?? null,
      avatarUrl: author.avatarAsset?.url ?? null,
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
  };
}

export function buildPublicPostTableResult(
  posts: PostTableSource[],
  total: number,
  request: { page: number; pageSize: number },
) {
  return {
    data: posts.map(mapPublicPostTableRow),
    total,
    page: request.page,
    pageSize: request.pageSize,
    totalPages: Math.ceil(total / request.pageSize),
  };
}
