import { fromJson } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { DocumentContentHeight, DocumentRegionPlacement } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { PostStatus as PublicPostStatus } from '@echovisionlab/geul-proto/public/post_pb.ts';
import { PostAction, PostStatus } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assetRefFixture } from '@/tests/helpers/asset-ref';
import * as queries from './post';

const mocks = vi.hoisted(() => ({
  createPostClient: vi.fn(),
  createPublicPostClient: vi.fn(),
  createPublicPostClientWithAuth: vi.fn(),
  loggerError: vi.fn(),
}));

const postClient = vi.hoisted(() => ({
  getPost: vi.fn(),
  listPostsAdmin: vi.fn(),
}));

const publicPostClient = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
  listMapFeatures: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createPostClient: mocks.createPostClient,
  createPublicPostClient: mocks.createPublicPostClient,
  createPublicPostClientWithAuth: mocks.createPublicPostClientWithAuth,
}));

vi.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({ error: mocks.loggerError }),
}));

const date = timestampFromDate(new Date('2026-01-01T00:00:00Z'));
const protoDocumentLayout = {
  contentHeight: DocumentContentHeight.VIEWPORT,
  pageChrome: DocumentRegionPlacement.PINNED,
  footer: DocumentRegionPlacement.FLOW,
};

function adminPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-1',
    title: 'Post',
    slug: 'post',
    summary: 'Summary',
    status: PostStatus.PUBLISHED,
    commentsEnabled: true,
    featuredImageDelivery: { thumbnail: assetRefFixture('https://cdn.example/post.webp') },
    publishedAt: date,
    createdAt: date,
    updatedAt: undefined,
    authorMembers: [{ id: 'author-1', nickname: 'Author', deleted: false }],
    allowedActions: [PostAction.EDIT, PostAction.PUBLISH_NOW],
    categories: [{ id: 'cat-1', name: 'Category', slug: undefined, description: undefined }],
    tags: [{ id: 'tag-1', name: 'Tag', slug: undefined }],
    series: { id: 'series-1', title: 'Series', slug: 'series', description: undefined },
    seriesOrder: 1,
    mapPlaceId: undefined,
    ogImageUrl: undefined,
    documentLayout: protoDocumentLayout,
    ...overrides,
  };
}

function localizedDocument(id = '019cd13a-3716-79af-8490-dbd124708824', locale = 'ko') {
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale,
    base: {
      nodes: [
        {
          block: { id, paragraph: { props: {} } },
          placement: { index: 0 },
        },
      ],
    },
    localeOverlay: {
      locale,
      blocks: [
        {
          blockId: id,
          paragraph: { props: {}, content: [{ text: { text: id } }] },
        },
      ],
    },
  });
}

function publicPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-1',
    title: 'Post',
    slug: 'post',
    summary: 'Summary',
    document: localizedDocument(),
    documentLayout: protoDocumentLayout,
    status: PublicPostStatus.PUBLISHED,
    commentsEnabled: true,
    featuredImageDelivery: { thumbnail: assetRefFixture('https://cdn.example/post.webp') },
    publishedAt: date,
    createdAt: date,
    updatedAt: undefined,
    authorMembers: [{ id: 'author-1', nickname: 'Author', deleted: false }],
    categories: [{ id: 'cat-1', name: 'Category', slug: undefined }],
    tags: [{ id: 'tag-1', name: 'Tag', slug: undefined }],
    series: { id: 'series-1', title: 'Series', slug: 'series' },
    mapPlaceId: undefined,
    locationPlace: { name: 'Place', lat: 37, lng: 127, googlePlaceId: undefined },
    ...overrides,
  };
}

describe('post server queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPostClient.mockResolvedValue(postClient);
    mocks.createPublicPostClient.mockReturnValue(publicPostClient);
    mocks.createPublicPostClientWithAuth.mockResolvedValue(publicPostClient);

    postClient.listPostsAdmin.mockResolvedValue({
      posts: [{ post: adminPost(), viewCount: 10, commentCount: 2 }],
      pagination: { total: 1 },
    });
    postClient.getPost.mockResolvedValue(adminPost());
    publicPostClient.list.mockResolvedValue({
      posts: [publicPost()],
      pagination: { total: 1, limit: 10, offset: 0, hasMore: false },
    });
    publicPostClient.get.mockResolvedValue({
      post: publicPost(),
      blockMedia: [],
    });
    publicPostClient.listMapFeatures.mockResolvedValue({
      clusters: [
        {
          id: 'cluster-1',
          lat: 37,
          lng: 127,
          placeCount: 2,
          postCount: 3,
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

  it('maps admin and public post lists', async () => {
    await expect(
      queries.listPostsAdmin({
        page: 2,
        pageSize: 5,
        search: 'post',
        status: 'published',
        categoryIds: ['cat-1'],
        tagIds: ['tag-1'],
        authorIds: ['author-1'],
        seriesId: 'series-1',
        requirePlace: true,
        sort: [{ field: 'title', order: 'desc' }],
      }),
    ).resolves.toMatchObject({
      data: [{ id: 'post-1', status: 'published', viewCount: 10, commentCount: 2 }],
      total: 1,
      page: 2,
    });
    await expect(
      queries.listPublishedPosts({
        categoryIds: ['cat-1'],
        tagIds: ['tag-1'],
        authorIds: ['author-1'],
        seriesId: 'series-1',
        mapPlaceIds: ['place-1'],
        requestedLocale: 'ko',
        sortBy: 'updated_at',
      }),
    ).resolves.toMatchObject({
      posts: [{ id: 'post-1', featured_image_url: 'https://cdn.example/post.webp' }],
      pagination: { total: 1, hasMore: false },
    });
    await expect(
      queries.listPublishedPostsTable({
        query: { page: 1, pageSize: 10 },
        statuses: ['published'],
        categoryIds: ['cat-1'],
        tagIds: ['tag-1'],
        authorIds: ['author-1'],
        seriesId: 'series-1',
      }),
    ).resolves.toMatchObject({ data: [{ id: 'post-1', authors: [{ avatarUrl: null }] }] });
  });

  it('maps map features, public details, share-token details, and edit details', async () => {
    await expect(
      queries.listPostMapFeatures({
        requestedLocale: 'ko',
        categoryIds: ['cat-1'],
        tagIds: ['tag-1'],
        authorIds: ['author-1'],
        seriesId: 'series-1',
        requirePlace: true,
        sortBy: 'title',
        viewport: {
          bounds: { west: 120, south: 30, east: 130, north: 40 },
          zoom: 8,
          widthPx: 300.4,
          heightPx: 200.6,
          clusterRadiusPx: 40.2,
          minClusterPoints: 2.1,
        },
      }),
    ).resolves.toMatchObject({
      clusters: [{ id: 'cluster-1', bounds: { west: 127, south: 37, east: 127, north: 37 } }],
      items: [{ placeId: 'place-1', primaryPostSlug: null }],
    });
    await expect(queries.getPostView('post', { requestedLocale: 'ko' })).resolves.toMatchObject({
      id: 'post-1',
      content: [{ id: '019cd13a-3716-79af-8490-dbd124708824', kind: 'paragraph' }],
      documentLayout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' },
      status: 'published',
      locationPlace: { name: 'Place', googlePlaceId: null },
    });
    await expect(queries.getPostViewWithToken('post', 'token', 'ko')).resolves.toMatchObject({
      id: 'post-1',
      content: [{ id: '019cd13a-3716-79af-8490-dbd124708824', kind: 'paragraph' }],
      documentLayout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' },
    });
    await expect(queries.getPostForEdit('00000000-0000-4000-8000-000000000001')).resolves.toMatchObject({
      id: 'post-1',
      allowedActions: [PostAction.EDIT, PostAction.PUBLISH_NOW],
      authors: [{ id: 'author-1', nickname: 'Author' }],
      categories: [{ id: 'cat-1' }],
      tags: [{ id: 'tag-1' }],
      documentLayout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' },
    });
  });

  it('resolves an authorized edit slug to the manage Post ID', async () => {
    const postId = '00000000-0000-4000-8000-000000000001';
    publicPostClient.get.mockResolvedValueOnce({ post: publicPost({ id: postId, slug: 'post-slug' }) });
    postClient.getPost.mockResolvedValueOnce(adminPost({ id: postId, slug: 'post-slug' }));

    await expect(queries.getPostForEdit('post-slug')).resolves.toMatchObject({ id: postId, slug: 'post-slug' });

    expect(publicPostClient.get).toHaveBeenCalledWith({ slug: 'post-slug' });
    expect(postClient.getPost).toHaveBeenCalledWith({ id: postId });
  });

  it('throws for a Post body envelope instead of rendering blank content', async () => {
    publicPostClient.get.mockResolvedValueOnce({
      post: publicPost({
        document: fromJson(LocalizedRichTextDocumentSchema, {
          blockCatalogFingerprint: 'invalid',
          profile: RichTextProfile.POST,
          locale: 'ko',
          base: { nodes: [] },
          localeOverlay: { locale: 'ko', blocks: [] },
        }),
      }),
    });

    await expect(queries.getPostView('post')).rejects.toThrow();
    expect(mocks.loggerError).toHaveBeenCalledWith('GetPostView failed', {
      error: expect.anything(),
    });
  });

  it('switches to the source Post body without changing root layout ownership', async () => {
    const localizationInfo = (displayedLocale: string) => ({
      requestedLocale: 'en',
      displayedLocale,
      sourceLocale: 'ko',
      isFallback: displayedLocale !== 'ko',
      isOriginal: displayedLocale === 'ko',
      machineGenerated: false,
      fallbackReason: 0,
      availableLocales: ['ko', 'en'],
    });
    publicPostClient.get
      .mockResolvedValueOnce({
        post: publicPost({
          document: localizedDocument('019cd13a-3716-79af-8490-dbd124708825', 'en'),
          localizationInfo: localizationInfo('en'),
        }),
      })
      .mockResolvedValueOnce({
        post: publicPost({
          document: localizedDocument('019cd13a-3716-79af-8490-dbd124708826', 'ko'),
          localizationInfo: localizationInfo('ko'),
        }),
      });

    await expect(
      queries.getPostView('post', { requestedLocale: 'en', preferSourceLocale: true }),
    ).resolves.toMatchObject({
      content: [{ id: '019cd13a-3716-79af-8490-dbd124708826' }],
      documentLayout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' },
    });
    expect(mocks.createPublicPostClientWithAuth).toHaveBeenNthCalledWith(1, 'en');
    expect(mocks.createPublicPostClientWithAuth).toHaveBeenNthCalledWith(2, 'ko');
  });

  it('returns null or empty results for handled auth failures', async () => {
    postClient.listPostsAdmin.mockRejectedValueOnce(new ConnectError('denied', Code.PermissionDenied));
    await expect(queries.listPostsAdmin({})).resolves.toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });

    publicPostClient.get.mockRejectedValueOnce(new ConnectError('missing', Code.NotFound));
    await expect(queries.getPostView('missing')).resolves.toBeNull();

    publicPostClient.get.mockRejectedValueOnce(new ConnectError('invalid share token', Code.NotFound));
    await expect(queries.getPostViewWithToken('draft', 'invalid-token')).resolves.toBeNull();

    postClient.getPost.mockRejectedValueOnce(new ConnectError('missing', Code.NotFound));
    await expect(queries.getPostForEdit('00000000-0000-4000-8000-000000000001')).resolves.toBeNull();
  });

  it('keeps handled edit lookup failures as null without logging', async () => {
    const notFoundError = new ConnectError('missing', Code.NotFound);
    postClient.getPost.mockRejectedValueOnce(notFoundError);

    await expect(queries.getPostForEdit('00000000-0000-4000-8000-000000000001')).resolves.toBeNull();

    const permissionDeniedError = new ConnectError('denied', Code.PermissionDenied);
    postClient.getPost.mockRejectedValueOnce(permissionDeniedError);
    await expect(queries.getPostForEdit('00000000-0000-4000-8000-000000000001')).resolves.toBeNull();

    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it('logs and propagates an internal edit lookup RPC error unchanged', async () => {
    const internalError = new ConnectError('database unavailable', Code.Internal);
    postClient.getPost.mockRejectedValueOnce(internalError);

    await expect(queries.getPostForEdit('00000000-0000-4000-8000-000000000001')).rejects.toBe(internalError);
    expect(mocks.loggerError).toHaveBeenCalledOnce();
    expect(mocks.loggerError).toHaveBeenCalledWith('GetPostForEdit failed', {
      error: internalError,
    });
  });

  it('logs and propagates an edit lookup transport error unchanged', async () => {
    const transportError = new Error('connection closed');
    postClient.getPost.mockRejectedValueOnce(transportError);

    await expect(queries.getPostForEdit('00000000-0000-4000-8000-000000000001')).rejects.toBe(transportError);
    expect(mocks.loggerError).toHaveBeenCalledOnce();
    expect(mocks.loggerError).toHaveBeenCalledWith('GetPostForEdit failed', {
      error: transportError,
    });
  });

  it('logs and propagates malformed edit route encoding', async () => {
    let thrown: unknown;
    try {
      await queries.getPostForEdit('%E0%A4%A');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(URIError);
    expect(postClient.getPost).not.toHaveBeenCalled();
    expect(mocks.loggerError).toHaveBeenCalledOnce();
    expect(mocks.loggerError).toHaveBeenCalledWith('GetPostForEdit failed', {
      error: thrown,
    });
  });

  it('propagates public Post RPC and transport failures instead of converting them to false 404s', async () => {
    const publicPermissionError = new ConnectError('unexpected permission denial', Code.PermissionDenied);
    publicPostClient.get.mockRejectedValueOnce(publicPermissionError);
    await expect(queries.getPostView('private')).rejects.toBe(publicPermissionError);

    const sharePermissionError = new ConnectError('unexpected share permission denial', Code.PermissionDenied);
    publicPostClient.get.mockRejectedValueOnce(sharePermissionError);
    await expect(queries.getPostViewWithToken('draft', 'denied-token')).rejects.toBe(sharePermissionError);

    const internalError = new ConnectError('database unavailable', Code.Internal);
    publicPostClient.get.mockRejectedValueOnce(internalError);
    await expect(queries.getPostView('post')).rejects.toBe(internalError);

    const transportError = new Error('connection closed');
    publicPostClient.get.mockRejectedValueOnce(transportError);
    await expect(queries.getPostViewWithToken('post', 'token')).rejects.toBe(transportError);
  });
});
