import { isConnectError, isConnectErrorCode } from '@/lib/api/connect-error';
import { create } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { FilterOp, FilterSpecSchema, SortOrder, SortSpecSchema } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { PostAction, Post as ProtoPost } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import { createPostClient, createPublicPostClient, createPublicPostClientWithAuth } from '@/lib/api/server-client';
import { materializeLocalizedRichTextTree } from '@/features/editor/contract/localized-rich-text';
import { mapProtoDocumentLayout } from '@/lib/queries/document-layout';
import {
  buildPostMapFeatureRequest,
  mapPostMapFeatureResponse,
  type PostMapFeatureRequestInput,
} from '@/lib/queries/map-features';
import { mapPublicLocalizationInfo, maybeFetchSourceLocale } from '@/lib/queries/localized-public';
import { resolvePostFeaturedImageUrl } from '@/lib/media/post-featured-image';
import {
  buildPublishedPostsTableRequest,
  buildPublicPostTableResult,
  type PublishedPostsTableInput,
} from '@/lib/queries/post-table';
import type { PostMapFeatureResponse } from '@/lib/types/map/features';
import {
  postStatusToString as protoStatusToString,
  publicPostStatusToString as publicStatusToString,
  stringToPostStatus as stringStatusToProto,
} from '@/lib/types/post/proto';
import { createLogger } from '@/lib/utils/logger';
import { isValidUuid } from '@/lib/utils/validation';

const logger = createLogger('post-queries');

function toLocationPlace(
  place?: { name: string; lat: number; lng: number; googlePlaceId?: string } | null,
): { name: string; lat: number; lng: number; googlePlaceId: string | null } | null {
  if (!place) {
    return null;
  }

  return {
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    googlePlaceId: place.googlePlaceId ?? null,
  };
}

// Convert proto Post to a plain object for serialization
function toPlainPost(post: ProtoPost) {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    summary: post.summary,
    status: protoStatusToString(post.status),
    commentsEnabled: post.commentsEnabled,
    featuredImageUrl: resolvePostFeaturedImageUrl(post.featuredImageDelivery),
    documentLayout: mapProtoDocumentLayout(post.documentLayout),
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
  authorIds?: string[];
  seriesId?: string;
  mapPlaceIds?: string[];
  requirePlace?: boolean;
}

export type { PublicPostTableRow } from '@/lib/queries/post-table';

export async function listPostsAdmin(input: PostListInput) {
  try {
    const client = await createPostClient();
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
    if (input.search) {
      filters.push(create(FilterSpecSchema, { field: 'search', op: FilterOp.ILIKE, value: input.search }));
    }
    const response = await client.listPostsAdmin({
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

    const posts = (response.posts ?? []).map((p) => ({
      ...toPlainPost(p.post!),
      viewCount: p.viewCount,
      commentCount: p.commentCount,
    }));

    return {
      data: posts,
      total: response.pagination?.total || 0,
      page: input.page || 1,
      pageSize: input.pageSize || 20,
      totalPages: Math.ceil((response.pagination?.total || 0) / (input.pageSize || 20)),
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.PermissionDenied)) {
      return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    }
    throw err;
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
  requestedLocale?: string | null;
}) {
  const client = input.requestedLocale
    ? await createPublicPostClientWithAuth(input.requestedLocale)
    : createPublicPostClient();
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

export async function listPublishedPostsTable(input: PublishedPostsTableInput & { requestedLocale?: string | null }) {
  const client = input.requestedLocale
    ? await createPublicPostClientWithAuth(input.requestedLocale)
    : createPublicPostClient();
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
    ? await createPublicPostClientWithAuth(input.requestedLocale)
    : createPublicPostClient();
  const response = await client.listMapFeatures(buildPostMapFeatureRequest(input));
  return mapPostMapFeatureResponse(response);
}

export async function getPostView(
  idOrSlug: string,
  options?: { preferSourceLocale?: boolean; requestedLocale?: string | null },
) {
  try {
    const slug = decodeURIComponent(idOrSlug);
    const client = await createPublicPostClientWithAuth(options?.requestedLocale);
    let response = await client.get({ slug });
    response = await maybeFetchSourceLocale({
      preferSourceLocale: options?.preferSourceLocale,
      initialResponse: response,
      entity: response.post ?? null,
      fetchWithLocale: async (locale) => {
        const sourceClient = await createPublicPostClientWithAuth(locale);
        return sourceClient.get({ slug });
      },
    });

    const post = response.post;
    if (!post) {
      return null;
    }

    const content = post.document ? materializeLocalizedRichTextTree(post.document) : null;

    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      summary: post.summary,
      content,
      blockMedia: response.blockMedia,
      documentLayout: mapProtoDocumentLayout(post.documentLayout),
      status: publicStatusToString(post.status),
      statusCode: post.status,
      commentsEnabled: post.commentsEnabled,
      featuredImageUrl: resolvePostFeaturedImageUrl(post.featuredImageDelivery),
      localizationInfo: mapPublicLocalizationInfo(post.localizationInfo),
      publishedAt: post.publishedAt ? timestampDate(post.publishedAt) : undefined,
      createdAt: post.createdAt ? timestampDate(post.createdAt) : undefined,
      updatedAt: post.updatedAt ? timestampDate(post.updatedAt) : undefined,
      authors: (post.authorMembers ?? []).map((a) => ({
        id: a.id,
        name: a.nickname,
        avatarUrl: a.avatarAsset?.url,
      })),
      categories: (post.categories ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
      })),
      tags: (post.tags ?? []).map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
      series: post.series ? { id: post.series.id, title: post.series.title, slug: post.series.slug } : undefined,
      mapPlaceId: post.mapPlaceId ?? null,
      locationPlace: toLocationPlace(post.locationPlace ?? null),
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    logger.error('GetPostView failed', { error: err });
    throw err;
  }
}

export async function getPostViewWithToken(
  idOrSlug: string,
  token: string,
  requestedLocale?: string | null,
  sharePassword?: string,
) {
  try {
    const client = await createPublicPostClientWithAuth(requestedLocale);
    const response = await client.get({
      slug: decodeURIComponent(idOrSlug),
      shareToken: token,
      sharePassword: sharePassword?.trim() || undefined,
    });

    const post = response.post;
    if (!post) {
      return null;
    }

    const content = post.document ? materializeLocalizedRichTextTree(post.document) : null;

    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      summary: post.summary,
      content,
      blockMedia: response.blockMedia,
      documentLayout: mapProtoDocumentLayout(post.documentLayout),
      status: publicStatusToString(post.status),
      statusCode: post.status,
      commentsEnabled: post.commentsEnabled,
      featuredImageUrl: resolvePostFeaturedImageUrl(post.featuredImageDelivery),
      localizationInfo: mapPublicLocalizationInfo(post.localizationInfo),
      publishedAt: post.publishedAt ? timestampDate(post.publishedAt) : undefined,
      createdAt: post.createdAt ? timestampDate(post.createdAt) : undefined,
      updatedAt: post.updatedAt ? timestampDate(post.updatedAt) : undefined,
      authors: (post.authorMembers ?? []).map((a) => ({
        id: a.id,
        name: a.nickname,
        avatarUrl: a.avatarAsset?.url,
      })),
      categories: (post.categories ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
      })),
      tags: (post.tags ?? []).map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
      series: post.series ? { id: post.series.id, title: post.series.title, slug: post.series.slug } : undefined,
      mapPlaceId: post.mapPlaceId ?? null,
      locationPlace: toLocationPlace(post.locationPlace ?? null),
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    logger.error('GetPostViewWithToken failed', { error: err });
    throw err;
  }
}

export async function getPostForEdit(idOrSlug: string) {
  try {
    const decoded = decodeURIComponent(idOrSlug);
    let postId = decoded;

    if (!isValidUuid(postId)) {
      const publicClient = await createPublicPostClientWithAuth();
      const response = await publicClient.get({ slug: decoded });
      if (!response.post?.id) {
        return null;
      }
      postId = response.post.id;
    }

    const client = await createPostClient();
    const post = await client.getPost({ id: postId });

    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      summary: post.summary,
      status: protoStatusToString(post.status),
      commentsEnabled: post.commentsEnabled,
      documentLayout: mapProtoDocumentLayout(post.documentLayout),
      featuredImageUrl: resolvePostFeaturedImageUrl(post.featuredImageDelivery),
      seriesId: post.series?.id,
      seriesOrder: post.seriesOrder,
      mapPlaceId: post.mapPlaceId ?? null,
      categories: (post.categories ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
      })),
      tags: (post.tags ?? []).map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
      authors: post.authorMembers.map((member) => ({
        id: member.id,
        nickname: member.nickname,
        avatarUrl: member.avatarAsset?.url ?? null,
      })),
      scheduledAt: post.scheduledAt ? timestampDate(post.scheduledAt).toISOString() : null,
      scheduledTimeZone: post.scheduledTimeZone ?? null,
      allowedActions: [...post.allowedActions],
      ogImageUrl: post.ogAsset?.url ?? null,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound, Code.PermissionDenied)) {
      return null;
    }
    logger.error('GetPostForEdit failed', { error: err });
    throw err;
  }
}

export async function getPostAllowedActions(postId: string): Promise<PostAction[]> {
  if (!isValidUuid(postId)) {
    return [];
  }

  try {
    const client = await createPostClient();
    const post = await client.getPost({ id: postId });
    return [...post.allowedActions];
  } catch (err) {
    if (
      isConnectError(err) &&
      (err.code === Code.Unauthenticated || err.code === Code.PermissionDenied || err.code === Code.NotFound)
    ) {
      return [];
    }
    throw err;
  }
}
