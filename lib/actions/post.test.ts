import { Code, ConnectError } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { RichTextDocumentSchema, RichTextProfile } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assetRefFixture } from '@/tests/helpers/asset-ref';
import * as actions from './post';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createPostClient: vi.fn(),
  createShareLinkAction: vi.fn(),
  deleteShareLinkAction: vi.fn(),
  listShareLinksAction: vi.fn(),
  regenerateOgImage: vi.fn(),
  revalidatePath: vi.fn(),
}));

const postClient = vi.hoisted(() => ({
  addPostAuthor: vi.fn(),
  addPostCollaborator: vi.fn(),
  archivePost: vi.fn(),
  createPost: vi.fn(),
  deletePost: vi.fn(),
  deletePostFeaturedImage: vi.fn(),
  getPost: vi.fn(),
  publishPost: vi.fn(),
  removePostAuthor: vi.fn(),
  removePostCollaborator: vi.fn(),
  schedulePost: vi.fn(),
  cancelPostSchedule: vi.fn(),
  republishPost: vi.fn(),
  setPostFeaturedImage: vi.fn(),
  unpublishPost: vi.fn(),
  updatePost: vi.fn(),
}));

const initialConfigurationRevision = '10000000-0000-4000-8000-000000000001';
const acknowledgedConfigurationRevision = '10000000-0000-4000-8000-000000000002';

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/lib/api/server-client', () => ({
  createAdminClient: mocks.createAdminClient,
  createPostClient: mocks.createPostClient,
}));

vi.mock('@/lib/actions/share-link', () => ({
  createShareLinkAction: mocks.createShareLinkAction,
  deleteShareLinkAction: mocks.deleteShareLinkAction,
  listShareLinksAction: mocks.listShareLinksAction,
}));

describe('post actions', () => {
  it('forwards the editor origin for configuration writes while preserving the revision guard', async () => {
    const origin = '20000000-0000-4000-8000-000000000001';
    const result = await actions.updatePostAction(
      'post-1',
      { commentsEnabled: false },
      initialConfigurationRevision,
      origin,
    );

    expect(result.ok).toBe(true);
    expect(mocks.createPostClient).toHaveBeenCalledWith(origin);
    expect(postClient.updatePost).toHaveBeenCalledWith({
      id: 'post-1',
      expectedConfigurationRevision: initialConfigurationRevision,
      commentsEnabled: false,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPostClient.mockResolvedValue(postClient);
    mocks.regenerateOgImage.mockResolvedValue({ ok: true, runId: 'run-1', generationIds: ['generation-1'] });
    mocks.createAdminClient.mockResolvedValue({ regenerateOgImage: mocks.regenerateOgImage });
    postClient.createPost.mockResolvedValue({ id: 'post-1' });
    postClient.updatePost.mockResolvedValue({
      id: 'post-1',
      slug: 'new-title',
      commentsEnabled: false,
      mapPlaceId: undefined,
      configurationRevision: acknowledgedConfigurationRevision,
    });
    postClient.setPostFeaturedImage.mockResolvedValue({
      imageDelivery: { thumbnail: assetRefFixture('https://cdn.example/post.webp') },
      ogGenerationRunId: 'featured-run',
    });
    postClient.deletePostFeaturedImage.mockResolvedValue({
      success: true,
      ogGenerationRunId: 'delete-featured-run',
    });
    postClient.getPost.mockResolvedValue({
      id: 'post-1',
      title: 'Post',
      slug: 'post-slug',
      summary: 'summary',
      commentsEnabled: true,
      mapPlaceId: 'place-1',
      configurationRevision: initialConfigurationRevision,
      document: create(RichTextDocumentSchema, {
        blockCatalogFingerprint: contentBlockCatalogFingerprint,
        profile: RichTextProfile.POST,
        sourceLocale: 'ko',
        base: { nodes: [] },
        localeOverlays: [{ locale: 'ko', blocks: [] }],
      }),
    });
    mocks.createShareLinkAction.mockResolvedValue({ ok: true, shareLink: { id: 'share-1' } });
    mocks.deleteShareLinkAction.mockResolvedValue({ ok: true, success: true });
    mocks.listShareLinksAction.mockResolvedValue({ ok: true, value: [{ id: 'share-1' }] });
  });

  it('loads the current Post configuration for a stale settings save retry', async () => {
    await expect(actions.getPostConfigurationAction('post-1')).resolves.toEqual({
      ok: true,
      configuration: {
        configurationRevision: initialConfigurationRevision,
        slug: 'post-slug',
        commentsEnabled: true,
        mapPlaceId: 'place-1',
        documentLayout: { contentHeight: 'content', pageChrome: 'flow', footer: 'flow' },
      },
    });
    expect(postClient.getPost).toHaveBeenCalledWith({ id: 'post-1' });
  });

  it('does not queue an unscoped OG regeneration', async () => {
    await expect(actions.regeneratePostOgImageAction('post-1', '')).resolves.toEqual({
      ok: false,
      error: 'Locale is required to regenerate this OG image',
      errorCode: 'ACTION_INVALID_LOCALE',
    });

    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.regenerateOgImage).not.toHaveBeenCalled();
  });

  it('does not report a committed delete as failed when cache revalidation throws', async () => {
    mocks.revalidatePath
      .mockImplementationOnce(() => {
        throw new Error('cache unavailable');
      })
      .mockImplementationOnce(() => {
        throw new Error('cache unavailable');
      });

    await expect(actions.deletePostAdminAction('post-1')).resolves.toEqual({ ok: true, success: true });
    await expect(actions.deletePostAction('post-2')).resolves.toEqual({ ok: true, success: true });
    expect(postClient.deletePost).toHaveBeenCalledTimes(2);
  });

  it('returns user-facing authorization and backend errors', async () => {
    postClient.createPost.mockRejectedValueOnce(new ConnectError('missing auth', Code.Unauthenticated));
    await expect(actions.createPostAction()).resolves.toEqual({
      ok: false,
      error: 'Unauthorized',
      errorCode: Code.Unauthenticated,
    });

    postClient.deletePost.mockRejectedValueOnce(new ConnectError('denied', Code.PermissionDenied));
    await expect(actions.deletePostAdminAction('post-1')).resolves.toEqual({
      ok: false,
      error: 'Unauthorized',
      errorCode: Code.PermissionDenied,
    });

    postClient.publishPost.mockRejectedValueOnce(new Error('backend down'));
    await expect(actions.publishPostAction('post-1')).resolves.toEqual({
      ok: false,
      error: 'backend down',
      errorCode: 'POST_PUBLISH_FAILED',
    });
  });
});
