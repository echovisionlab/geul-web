import { isConnectErrorCode } from '@/lib/api/connect-error';
import { create } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { FilterOp, FilterSpecSchema, SortOrder, SortSpecSchema } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { PostParticipantRole, Post as ProtoPost } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import { PostStatus as PublicPostStatus } from '@echovisionlab/geul-proto/public/post_pb.ts';
import { createPostClient, createPublicPostClient, createPublicPostClientWithLocale } from '@/lib/api/browser-client';
import {
  buildPublishedPostsTableRequest,
  buildPublicPostTableResult,
  type PublishedPostsTableInput,
} from '@/lib/queries/post-table';
import {
  buildPostMapFeatureRequest,
  mapPostMapFeatureResponse,
  type PostMapFeatureRequestInput,
} from '@/lib/queries/map-features';
import type { PostMapFeatureResponse } from '@/lib/types/map/features';
import { resolvePostFeaturedImageUrl } from '@/lib/media/post-featured-image';
import type { PaginatedQuery } from '@/lib/types/common/query';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';
import {
  postStatusToString as protoStatusToString,
  stringToPostStatus as stringStatusToProto,
} from '@/lib/types/post/proto';

function toPlainPost(post: ProtoPost) {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    summary: post.summary,
    status: protoStatusToString(post.status),
    commentsEnabled: post.commentsEnabled,
    featuredImageUrl: resolvePostFeaturedImageUrl(post.featuredImageDelivery),
    publishedAt: post.publishedAt ? timestampDate(post.publishedAt).toISOString() : undefined,
    createdAt: post.createdAt ? timestampDate(post.createdAt).toISOString() : undefined,
    updatedAt: post.updatedAt ? timestampDate(post.updatedAt).toISOString() : undefined,
    author: post.authorMembers[0]
      ? {
          id: post.authorMembers[0].id,
          name: post.authorMembers[0].nickname,
          avatarUrl: post.authorMembers[0].avatarAsset?.url,
        }
      : undefined,
    authors: post.authorMembers.map((author) => ({
      id: author.id,
      name: author.nickname,
      avatarUrl: author.avatarAsset?.url,
    })),
    scheduledAt: post.scheduledAt ? timestampDate(post.scheduledAt).toISOString() : undefined,
    scheduledTimeZone: post.scheduledTimeZone,
    allowedActions: [...post.allowedActions],
    categories: post.categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
    })),
    tags: post.tags.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
    })),
    series: post.series
      ? {
          id: post.series.id,
          title: post.series.title,
          slug: post.series.slug,
          description: post.series.description,
        }
      : undefined,
    seriesOrder: post.seriesOrder,
    mapPlaceId: post.mapPlaceId,
  };
}

interface PostListInput {
  filter?: unknown;
  filterBy?: 'AND' | 'OR';
  sort?: { field: string; order?: 'asc' | 'desc' }[];
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  categoryIds?: string[];
  tagIds?: string[];
  seriesId?: string;
  mapPlaceIds?: string[];
  requirePlace?: boolean;
}

export type { PublicPostTableRow } from '@/lib/queries/post-table';

export async function listMyPosts(input: PostListInput) {
  try {
    const client = createPostClient();
    const filters = [];
    const statusProto = stringStatusToProto(input.status);
    if (statusProto !== undefined) {
      filters.push(create(FilterSpecSchema, { field: 'status', op: FilterOp.EQ, value: String(statusProto) }));
    }
    if (input.categoryIds && input.categoryIds.length > 0) {
      filters.push(
        create(FilterSpecSchema, {
          field: 'category_id',
          op: FilterOp.IN,
          values: input.categoryIds,
        }),
      );
    }
    if (input.tagIds && input.tagIds.length > 0) {
      filters.push(create(FilterSpecSchema, { field: 'tag_id', op: FilterOp.IN, values: input.tagIds }));
    }
    if (input.seriesId) {
      filters.push(create(FilterSpecSchema, { field: 'series_id', op: FilterOp.EQ, value: input.seriesId }));
    }
    if (input.mapPlaceIds && input.mapPlaceIds.length > 0) {
      filters.push(
        create(FilterSpecSchema, {
          field: 'map_place_id',
          op: FilterOp.IN,
          values: input.mapPlaceIds,
        }),
      );
    } else if (input.requirePlace) {
      filters.push(create(FilterSpecSchema, { field: 'map_place_id', op: FilterOp.IS_NOT_NULL }));
    }
    if (input.search) {
      filters.push(create(FilterSpecSchema, { field: 'search', op: FilterOp.ILIKE, value: input.search }));
    }
    const response = await client.listMyPosts({
      pagination: {
        limit: input.pageSize || 20,
        offset: ((input.page || 1) - 1) * (input.pageSize || 20),
      },
      filters,
      sorts: input.sort?.map((s) => ({
        field: s.field,
        order: s.order === 'desc' ? SortOrder.DESC : SortOrder.ASC,
      })),
    });

    return {
      data: (response.posts ?? []).map(toPlainPost),
      total: response.pagination?.total || 0,
      page: input.page || 1,
      pageSize: input.pageSize || 20,
      totalPages: Math.ceil((response.pagination?.total || 0) / (input.pageSize || 20)),
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    }
    throw err;
  }
}

export async function searchPublishedPosts(query: string, limit: number = 10) {
  const client = createPublicPostClient();
  const response = await client.search({ query, limit });

  return (response.posts ?? []).map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    summary: post.summary,
    featuredImageUrl: resolvePostFeaturedImageUrl(post.featuredImageDelivery),
    mapPlaceId: post.mapPlaceId ?? null,
    publishedAt: post.publishedAt ? timestampDate(post.publishedAt).toISOString() : undefined,
    authors: (post.authorMembers ?? []).map((a) => ({ id: a.id, name: a.nickname })),
    categories: (post.categories ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    tags: (post.tags ?? []).map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
  }));
}

export async function getPostPermissionRevokedDestination(idOrSlug: string): Promise<string> {
  try {
    const response = await createPublicPostClient().get({ slug: decodeURIComponent(idOrSlug) });
    const post = response.post;
    if (!post || (post.status !== PublicPostStatus.PUBLISHED && post.status !== PublicPostStatus.ARCHIVED)) {
      return '/';
    }
    return `/posts/${encodeURIComponent(post.slug || post.id)}`;
  } catch {
    return '/';
  }
}

export async function listPublishedPosts(input: {
  categoryIds?: string[];
  tagIds?: string[];
  authorIds?: string[];
  seriesId?: string;
  mapPlaceIds?: string[];
  requirePlace?: boolean;
  sortBy?: 'published_at' | 'updated_at' | 'title' | 'series_order';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}) {
  const client = createPublicPostClient();
  const filters = [];
  if (input.categoryIds && input.categoryIds.length > 0) {
    filters.push(create(FilterSpecSchema, { field: 'category_id', op: FilterOp.IN, values: input.categoryIds }));
  }
  if (input.tagIds && input.tagIds.length > 0) {
    filters.push(create(FilterSpecSchema, { field: 'tag_id', op: FilterOp.IN, values: input.tagIds }));
  }
  if (input.authorIds && input.authorIds.length > 0) {
    filters.push(create(FilterSpecSchema, { field: 'author_id', op: FilterOp.IN, values: input.authorIds }));
  }
  if (input.seriesId) {
    filters.push(create(FilterSpecSchema, { field: 'series_id', op: FilterOp.EQ, value: input.seriesId }));
  }
  if (input.mapPlaceIds && input.mapPlaceIds.length > 0) {
    filters.push(
      create(FilterSpecSchema, {
        field: 'map_place_id',
        op: FilterOp.IN,
        values: input.mapPlaceIds,
      }),
    );
  } else if (input.requirePlace) {
    filters.push(create(FilterSpecSchema, { field: 'map_place_id', op: FilterOp.IS_NOT_NULL }));
  }
  const sortField = input.sortBy === 'updated_at' ? 'published_at' : input.sortBy;
  const sorts = sortField
    ? [
        create(SortSpecSchema, {
          field: sortField,
          order: input.sortOrder === 'desc' ? SortOrder.DESC : SortOrder.ASC,
        }),
      ]
    : [];
  const response = await client.list({
    pagination: { limit: input.limit || 10, offset: input.offset || 0 },
    filters,
    sorts,
  });

  return {
    posts: (response.posts ?? []).map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      summary: post.summary,
      featured_image_url: resolvePostFeaturedImageUrl(post.featuredImageDelivery),
      map_place_id: post.mapPlaceId ?? null,
      published_at: post.publishedAt ? timestampDate(post.publishedAt) : undefined,
      authors: (post.authorMembers ?? []).map((a) => ({
        id: a.id,
        name: a.nickname,
        avatar_url: a.avatarAsset?.url ?? null,
      })),
      categories: (post.categories ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
      tags: (post.tags ?? []).map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
    })),
    pagination: {
      total: response.pagination?.total ?? 0,
      limit: response.pagination?.limit ?? (input.limit || 10),
      offset: response.pagination?.offset ?? (input.offset || 0),
      hasMore: response.pagination?.hasMore ?? false,
    },
  };
}

export async function listPublishedPostsTable(input: PublishedPostsTableInput) {
  const client = createPublicPostClient();
  const request = buildPublishedPostsTableRequest(input);
  const response = await client.list({
    pagination: request.pagination,
    filters: request.filters,
    sorts: request.sorts,
  });

  return buildPublicPostTableResult(response.posts ?? [], response.pagination?.total ?? 0, request);
}

export async function listPostMapFeatures(
  input: PostMapFeatureRequestInput & {
    requestedLocale?: string | null;
  },
): Promise<PostMapFeatureResponse> {
  const client = input.requestedLocale
    ? createPublicPostClientWithLocale(input.requestedLocale)
    : createPublicPostClient();
  const response = await client.listMapFeatures(buildPostMapFeatureRequest(input));
  return mapPostMapFeatureResponse(response);
}

interface TaxonomyPostRow {
  id: string;
  title: string;
  slug: string | undefined;
  summary: string | undefined;
  publishedAt: string | undefined;
  authors: { id: string; name: string | null }[];
}

function toFilterOp(op: string): FilterOp | null {
  switch (op) {
    case 'eq':
      return FilterOp.EQ;
    case 'ne':
      return FilterOp.NEQ;
    case 'gt':
      return FilterOp.GT;
    case 'gte':
      return FilterOp.GTE;
    case 'lt':
      return FilterOp.LT;
    case 'lte':
      return FilterOp.LTE;
    case 'like':
      return FilterOp.LIKE;
    case 'ilike':
      return FilterOp.ILIKE;
    case 'in':
      return FilterOp.IN;
    default:
      return null;
  }
}

function normalizeFilterValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

export async function listPublishedPostsByTaxonomy(input: {
  taxonomyType: 'category' | 'tag';
  taxonomyId: string;
  query: PaginatedQuery;
}): Promise<PaginatedQueryResult<TaxonomyPostRow>> {
  const client = createPublicPostClient();
  const page = Math.max(1, input.query.page ?? 1);
  const pageSize = Math.max(1, input.query.pageSize ?? 20);
  const offset = (page - 1) * pageSize;
  const filters = [];

  filters.push(
    create(FilterSpecSchema, {
      field: input.taxonomyType === 'category' ? 'category_id' : 'tag_id',
      op: FilterOp.EQ,
      value: input.taxonomyId,
    }),
  );

  const search = input.query.search?.trim();
  if (search) {
    filters.push(
      create(FilterSpecSchema, {
        field: 'search',
        op: FilterOp.ILIKE,
        value: search,
      }),
    );
  }

  // Public post list supports published_at filters; convert DataTable filter ops accordingly.
  for (const filter of input.query.filters ?? []) {
    if (filter.field !== 'published_at') {
      continue;
    }

    if (filter.op === 'between' && Array.isArray(filter.value)) {
      const from = normalizeFilterValue(filter.value[0]);
      const to = normalizeFilterValue(filter.value[1]);
      if (from) {
        filters.push(create(FilterSpecSchema, { field: 'published_at', op: FilterOp.GTE, value: from }));
      }
      if (to) {
        filters.push(create(FilterSpecSchema, { field: 'published_at', op: FilterOp.LTE, value: to }));
      }
      continue;
    }

    if (filter.op === 'isNull') {
      // List endpoint only returns published items, so published_at IS NULL is always empty.
      if (filter.value === true) {
        return { data: [], total: 0, page, pageSize, totalPages: 0 };
      }
      continue;
    }

    const mappedOp = toFilterOp(filter.op);
    if (!mappedOp) {
      continue;
    }

    if (mappedOp === FilterOp.IN && Array.isArray(filter.value)) {
      const values = filter.value.map((v) => normalizeFilterValue(v)).filter(Boolean);
      if (values.length > 0) {
        filters.push(
          create(FilterSpecSchema, {
            field: 'published_at',
            op: FilterOp.IN,
            values,
          }),
        );
      }
      continue;
    }

    const normalizedValue = normalizeFilterValue(filter.value);
    if (!normalizedValue) {
      continue;
    }
    filters.push(
      create(FilterSpecSchema, {
        field: 'published_at',
        op: mappedOp,
        value: normalizedValue,
      }),
    );
  }

  const sorts = [];
  for (const sort of input.query.sorts ?? []) {
    if (sort.field !== 'title' && sort.field !== 'published_at') {
      continue;
    }
    sorts.push(
      create(SortSpecSchema, {
        field: sort.field,
        order: sort.direction === 'asc' ? SortOrder.ASC : SortOrder.DESC,
      }),
    );
  }

  const response = await client.list({
    pagination: { limit: pageSize, offset },
    filters,
    sorts,
  });

  const data = (response.posts ?? []).map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    summary: post.summary,
    publishedAt: post.publishedAt ? timestampDate(post.publishedAt).toISOString() : undefined,
    authors: (post.authorMembers ?? []).map((a) => ({ id: a.id, name: a.nickname })),
  }));

  const total = response.pagination?.total ?? data.length;
  return {
    data,
    total,
    page:
      response.pagination?.offset !== undefined ? Math.floor((response.pagination.offset ?? 0) / pageSize) + 1 : page,
    pageSize: response.pagination?.limit ?? pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function listPostParticipants(postId: string) {
  try {
    const client = createPostClient();
    const response = await client.listPostParticipants({ postId });
    return response.participants.map((participant) => ({
      memberId: participant.member?.id ?? '',
      nickname: participant.member?.nickname ?? '',
      avatarUrl: participant.member?.avatarAsset?.url,
      role: participant.role === PostParticipantRole.AUTHOR ? ('author' as const) : ('collaborator' as const),
      hasEffectiveAuthority: participant.hasEffectiveAuthority,
      createdAt: participant.createdAt ? timestampDate(participant.createdAt).toISOString() : undefined,
    }));
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return [];
    }
    throw err;
  }
}

export async function checkPostSlugAvailable(slug: string, excludePostId?: string): Promise<{ available: boolean }> {
  try {
    const client = createPostClient();
    const response = await client.checkSlugAvailable({ slug, excludePostId });
    return { available: response.available };
  } catch {
    return { available: false };
  }
}
