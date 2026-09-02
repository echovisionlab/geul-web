import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { PostParticipantRole, PostStatus } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assetRefFixture } from '@/tests/helpers/asset-ref';
import * as queries from './post-browser';

const mocks = vi.hoisted(() => ({
  createPostClient: vi.fn(),
  createPublicPostClient: vi.fn(),
  createPublicPostClientWithLocale: vi.fn(),
}));

const postClient = vi.hoisted(() => ({
  checkSlugAvailable: vi.fn(),
  listMyPosts: vi.fn(),
  listPostParticipants: vi.fn(),
}));

const publicPostClient = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
  listMapFeatures: vi.fn(),
  search: vi.fn(),
}));

vi.mock('@/lib/api/browser-client', () => ({
  createPostClient: mocks.createPostClient,
  createPublicPostClient: mocks.createPublicPostClient,
  createPublicPostClientWithLocale: mocks.createPublicPostClientWithLocale,
}));

const publishedAt = timestampFromDate(new Date('2026-01-01T00:00:00Z'));

function post(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-1',
    title: 'Post',
    slug: 'post',
    summary: 'Summary',
    contentHtml: '<p>Post</p>',
    contentText: 'Post',
    status: PostStatus.PUBLISHED,
    commentsEnabled: true,
    featuredImageDelivery: { thumbnail: assetRefFixture('https://cdn.example/post.webp') },
    viewHash: 'view',
    publishedAt,
    createdAt: publishedAt,
    updatedAt: undefined,
    authorMembers: [{ id: 'author-1', nickname: 'Author', deleted: false }],
    allowedActions: [],
    categories: [{ id: 'cat-1', name: 'Category', slug: undefined }],
    tags: [{ id: 'tag-1', name: 'Tag', slug: 'tag' }],
    series: undefined,
    seriesOrder: 0,
    mapPlaceId: undefined,
    ...overrides,
  };
}

describe('post browser queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPostClient.mockReturnValue(postClient);
    mocks.createPublicPostClient.mockReturnValue(publicPostClient);
    mocks.createPublicPostClientWithLocale.mockReturnValue(publicPostClient);
    postClient.listMyPosts.mockResolvedValue({ posts: [post()], pagination: { total: 1 } });
    postClient.listPostParticipants.mockResolvedValue({
      participants: [
        {
          member: { id: 'member-1', nickname: 'Author' },
          role: PostParticipantRole.AUTHOR,
          hasEffectiveAuthority: true,
          createdAt: publishedAt,
        },
      ],
    });
    postClient.checkSlugAvailable.mockResolvedValue({ available: true });
    publicPostClient.search.mockResolvedValue({ posts: [post()] });
    publicPostClient.get.mockResolvedValue({ post: post() });
    publicPostClient.list.mockResolvedValue({
      posts: [post()],
      pagination: { total: 1, limit: 10, offset: 0, hasMore: false },
    });
    publicPostClient.listMapFeatures.mockResolvedValue({
      clusters: [
        {
          id: 'cluster-1',
          lat: 37,
          lng: 127,
          placeCount: 2,
          postCount: 5,
          minBreakoutZoom: undefined,
          bounds: undefined,
        },
      ],
      items: [
        {
          placeId: 'place-1',
          name: 'Place',
          address: 'Seoul',
          lat: 37.5,
          lng: 127.1,
          postCount: 1,
          primaryPostId: 'post-1',
          primaryPostSlug: undefined,
          primaryPostTitle: 'Post',
        },
      ],
    });
  });

  it('resolves a permission-revoked destination from the latest public Post read', async () => {
    await expect(queries.getPostPermissionRevokedDestination('post-1')).resolves.toBe('/posts/post');
    expect(publicPostClient.get).toHaveBeenCalledWith({ slug: 'post-1' });

    publicPostClient.get.mockResolvedValueOnce({ post: post({ status: PostStatus.ARCHIVED }) });
    await expect(queries.getPostPermissionRevokedDestination('post-1')).resolves.toBe('/posts/post');

    publicPostClient.get.mockResolvedValueOnce({ post: post({ status: PostStatus.DRAFT }) });
    await expect(queries.getPostPermissionRevokedDestination('post-1')).resolves.toBe('/');

    publicPostClient.get.mockRejectedValueOnce(new Error('network'));
    await expect(queries.getPostPermissionRevokedDestination('post-1')).resolves.toBe('/');
  });

  it('maps private and public post list/search responses', async () => {
    await expect(
      queries.listMyPosts({
        page: 2,
        pageSize: 5,
        search: 'post',
        status: 'published',
        categoryIds: ['cat-1'],
        tagIds: ['tag-1'],
        seriesId: 'series-1',
        requirePlace: true,
        sort: [{ field: 'title', order: 'asc' }],
      }),
    ).resolves.toMatchObject({
      data: [{ id: 'post-1', status: 'published', author: { id: 'author-1' } }],
      total: 1,
      page: 2,
    });
    await expect(queries.searchPublishedPosts('post', 4)).resolves.toEqual([
      expect.objectContaining({
        id: 'post-1',
        publishedAt: '2026-01-01T00:00:00.000Z',
        authors: [{ id: 'author-1', name: 'Author' }],
      }),
    ]);
    await expect(
      queries.listPublishedPosts({
        categoryIds: ['cat-1'],
        tagIds: ['tag-1'],
        authorIds: ['author-1'],
        seriesId: 'series-1',
        mapPlaceIds: ['place-1'],
        sortBy: 'updated_at',
        sortOrder: 'desc',
        limit: 10,
      }),
    ).resolves.toMatchObject({
      posts: [{ id: 'post-1', featured_image_url: 'https://cdn.example/post.webp' }],
      pagination: { total: 1, hasMore: false },
    });
  });

  it('maps public table, taxonomy, map feature, member, and slug queries', async () => {
    await expect(
      queries.listPublishedPostsTable({
        query: { page: 1, pageSize: 10, search: 'post' },
        statuses: ['published'],
        categoryIds: ['cat-1'],
        tagIds: ['tag-1'],
        authorIds: ['author-1'],
        seriesId: 'series-1',
      }),
    ).resolves.toMatchObject({
      data: [{ id: 'post-1', authors: [{ id: 'author-1', name: 'Author', avatarUrl: null }] }],
      total: 1,
    });
    await expect(
      queries.listPublishedPostsByTaxonomy({
        taxonomyType: 'category',
        taxonomyId: 'cat-1',
        query: {
          page: 1,
          pageSize: 10,
          search: ' post ',
          filters: [
            {
              field: 'published_at',
              op: 'between',
              value: [new Date('2026-01-01T00:00:00Z'), '2026-02-01T00:00:00Z'],
            },
            { field: 'published_at', op: 'in', value: ['2026-01-01T00:00:00Z'] },
          ],
          sorts: [{ field: 'published_at', direction: 'desc' }],
        },
      }),
    ).resolves.toMatchObject({ data: [{ id: 'post-1' }], total: 1 });
    await expect(
      queries.listPostMapFeatures({
        requestedLocale: 'ko',
        viewport: {
          bounds: { west: 120, south: 30, east: 130, north: 40 },
          zoom: 8,
          widthPx: 300.4,
          heightPx: 200.6,
          clusterRadiusPx: 40.2,
          minClusterPoints: 2.1,
        },
        requirePlace: true,
        sortBy: 'title',
        sortOrder: 'asc',
      }),
    ).resolves.toEqual({
      clusters: [
        {
          id: 'cluster-1',
          lat: 37,
          lng: 127,
          placeCount: 2,
          postCount: 5,
          minBreakoutZoom: null,
          bounds: { west: 127, south: 37, east: 127, north: 37 },
        },
      ],
      items: [
        {
          placeId: 'place-1',
          name: 'Place',
          address: 'Seoul',
          lat: 37.5,
          lng: 127.1,
          postCount: 1,
          primaryPostId: 'post-1',
          primaryPostSlug: null,
          primaryPostTitle: 'Post',
        },
      ],
    });
    await expect(queries.listPostParticipants('post-1')).resolves.toEqual([
      {
        memberId: 'member-1',
        nickname: 'Author',
        avatarUrl: undefined,
        role: 'author',
        hasEffectiveAuthority: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await expect(queries.checkPostSlugAvailable('post', 'post-1')).resolves.toEqual({
      available: true,
    });
  });

  it('returns stable empty responses for unauthenticated and impossible lookups', async () => {
    postClient.listMyPosts.mockRejectedValueOnce(new ConnectError('missing auth', Code.Unauthenticated));
    await expect(queries.listMyPosts({})).resolves.toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });

    await expect(
      queries.listPublishedPostsByTaxonomy({
        taxonomyType: 'tag',
        taxonomyId: 'tag-1',
        query: {
          filters: [{ field: 'published_at', op: 'isNull', value: true }],
        },
      }),
    ).resolves.toEqual({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });

    postClient.checkSlugAvailable.mockRejectedValueOnce(new Error('offline'));
    await expect(queries.checkPostSlugAvailable('taken')).resolves.toEqual({ available: false });
  });
});
