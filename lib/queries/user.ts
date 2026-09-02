import { isConnectError } from '@/lib/api/connect-error';
import { create } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { FilterOp, FilterSpecSchema } from '@echovisionlab/geul-proto/common/common_pb.ts';
import {
  USER_PUBLISHED_POST_ALLOWED_FILTER_FIELDS,
  USER_PUBLISHED_POST_ALLOWED_SORT_FIELDS,
} from '@/lib/types/user/table-spec';
import { createMemberClient, createPublicMemberClient, createPublicPostClientWithAuth } from '@/lib/api/server-client';
import { resolvePostFeaturedImageUrl } from '@/lib/media/post-featured-image';
import type { PaginatedQuery } from '@/lib/types/common/query';
import { accountRoleToString, accountStatusToString } from '@/lib/types/user/proto';
import { createLogger } from '@/lib/utils/logger';
import { listPublishedPostsTable } from './post';

const logger = createLogger('user-queries');

// Get user profile for public display (with computed isAdmin/isSelf flags)
export async function getUserProfileView(
  currentUserId: string | null | undefined,
  currentUserRole: string | null | undefined,
  targetUserId: string,
) {
  try {
    const isAdmin = currentUserRole === 'admin';
    const isSelf = currentUserId === targetUserId && Boolean(currentUserId);

    if (isAdmin) {
      const memberClient = await createMemberClient();
      const result = await memberClient.getMember({ memberId: targetUserId });
      const profile = result.member;
      const summary = profile?.summary;
      const account = result.account;
      if (!profile || !summary || !account || !summary.id || !summary.nickname.trim()) {
        return null;
      }

      return {
        id: summary.id,
        name: summary.nickname,
        image: summary.avatarAsset?.url ?? null,
        bio: profile.bio ?? null,
        social_links: profile.socialLinks,
        role: accountRoleToString(account.role),
        email_verified: account.canonicalEmail?.verified ?? false,
        status: accountStatusToString(account.status),
        banned: account.banned,
        ban_reason: account.banDetails?.reason ?? null,
        created_at: profile.createdAt ? timestampDate(profile.createdAt) : null,
        deleted: summary.deleted,
        isAdmin,
        isSelf,
      };
    }

    const publicMemberClient = createPublicMemberClient();
    const response = await publicMemberClient.getPublicMember({ memberId: targetUserId });
    const profile = response.member;
    const summary = profile?.summary;

    if (!profile || !summary || !summary.id || !summary.nickname.trim()) {
      return null;
    }

    return {
      id: summary.id,
      name: summary.nickname,
      image: summary.avatarAsset?.url ?? null,
      bio: profile.bio ?? null,
      social_links: profile.socialLinks,
      role: null,
      status: summary.deleted ? 'deleted' : 'active',
      banned: false,
      ban_reason: null,
      created_at: profile.createdAt ? timestampDate(profile.createdAt) : null,
      deleted: summary.deleted,
      isAdmin,
      isSelf,
    };
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('Public user profile RPC error', { error: err.message });
    }
    return null;
  }
}

// Get user's published posts
export async function getUserPublishedPosts(memberId: string, requestedLocale?: string | null) {
  try {
    const postClient = await createPublicPostClientWithAuth(requestedLocale);
    const filters = [create(FilterSpecSchema, { field: 'author_id', op: FilterOp.EQ, value: memberId })];
    const response = await postClient.list({
      pagination: { limit: 100, offset: 0 },
      filters,
    });

    return (response.posts ?? []).map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug ?? null,
      summary: post.summary ?? null,
      featured_image_url: resolvePostFeaturedImageUrl(post.featuredImageDelivery),
      published_at: post.publishedAt ? timestampDate(post.publishedAt) : null,
      created_at: post.publishedAt ? timestampDate(post.publishedAt) : new Date(),
    }));
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('GetUserPublishedPosts RPC error', { error: err.message });
    }
    return [];
  }
}

export async function listUserPublishedPostsTable(
  memberId: string,
  query: PaginatedQuery,
  requestedLocale?: string | null,
) {
  const normalizedQuery = query.sorts?.length
    ? query
    : {
        ...query,
        sorts: [{ field: 'published_at', direction: 'desc' as const }],
      };

  return listPublishedPostsTable({
    query: normalizedQuery,
    pageSize: 10,
    authorIds: [memberId],
    allowedFilterFields: USER_PUBLISHED_POST_ALLOWED_FILTER_FIELDS,
    allowedSortFields: USER_PUBLISHED_POST_ALLOWED_SORT_FIELDS,
    rejectInvalidQuery: true,
    requestedLocale,
  });
}

// Public: list authors for page blocks (Server Component version)
export async function listAuthorOptions(limit: number = 12) {
  const authors = await listAuthors(limit);

  return authors.map(({ id, name, image, postCount }) => ({ id, name, image, postCount }));
}

export async function listAuthors(limit: number = 12, memberIds: string[] = []) {
  try {
    const memberClient = createPublicMemberClient();
    const response = await memberClient.listAuthors(memberIds.length > 0 ? { limit, memberIds } : { limit });

    return (response.authors ?? []).map((author) => ({
      id: author.member?.id ?? '',
      name: author.member?.nickname ?? null,
      image: author.member?.avatarAsset?.url ?? null,
      bio: author.bio ?? null,
      postCount: author.postCount,
    }));
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListAuthors RPC error', { error: err.message });
    }
    return [];
  }
}
