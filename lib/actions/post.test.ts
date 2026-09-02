import { Code, ConnectError } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { DocumentContentHeight, DocumentRegionPlacement } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { RichTextDocumentSchema, RichTextProfile } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { OgEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
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
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPostClient.mockResolvedValue(postClient);
    mocks.regenerateOgImage.mockResolvedValue({ runId: 'run-1', generationIds: ['generation-1'] });
    mocks.createAdminClient.mockResolvedValue({ regenerateOgImage: mocks.regenerateOgImage });
    postClient.createPost.mockResolvedValue({ id: 'post-1' });
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
      document: create(RichTextDocumentSchema, {
        blockCatalogFingerprint: contentBlockCatalogFingerprint,
        profile: RichTextProfile.POST,
        sourceLocale: 'ko',
        base: { nodes: [] },
        localeOverlays: [{ locale: 'ko', blocks: [] }],
      }),
    });
    mocks.createShareLinkAction.mockResolvedValue({ shareLink: { id: 'share-1' } });
    mocks.deleteShareLinkAction.mockResolvedValue({ success: true });
    mocks.listShareLinksAction.mockResolvedValue([{ id: 'share-1' }]);
  });

  it('maps CRUD and status server actions to the post service', async () => {
    await expect(actions.createPostAction()).resolves.toEqual({ data: { id: 'post-1' } });
    await expect(
      actions.updatePostAction('post-1', {
        slug: 'new-title',
        commentsEnabled: false,
        mapPlaceId: '',
        documentLayout: {
          contentHeight: 'viewport',
          pageChrome: 'pinned',
          footer: 'flow',
        },
      }),
    ).resolves.toEqual({ success: true });
    await expect(actions.updatePostSlugAction('post-1', ' New Slug ')).resolves.toEqual({
      success: true,
      slug: ' New Slug ',
    });
    await expect(actions.publishPostAction('post-1')).resolves.toEqual({ success: true });
    await expect(actions.unpublishPostAction('post-1')).resolves.toEqual({ success: true });
    await expect(actions.archivePostAction('post-1')).resolves.toEqual({ success: true });
    await expect(
      actions.schedulePostAction('post-1', new Date('2026-08-05T06:30:00.000Z'), 'Asia/Seoul'),
    ).resolves.toEqual({ success: true });
    await expect(actions.cancelPostScheduleAction('post-1')).resolves.toEqual({ success: true });
    await expect(actions.republishPostAction('post-1')).resolves.toEqual({ success: true });
    await expect(actions.deletePostAdminAction('post-1')).resolves.toEqual({ success: true });
    await expect(actions.deletePostAction('post-2')).resolves.toEqual({ success: true });

    expect(postClient.createPost).toHaveBeenCalledWith({
      title: 'Untitled Post',
      commentsEnabled: true,
    });
    expect(postClient.updatePost).toHaveBeenCalledWith({
      id: 'post-1',
      slug: 'new-title',
      commentsEnabled: false,
      mapPlaceId: '',
      documentLayout: {
        contentHeight: DocumentContentHeight.VIEWPORT,
        pageChrome: DocumentRegionPlacement.PINNED,
        footer: DocumentRegionPlacement.FLOW,
      },
    });
    expect(postClient.updatePost).toHaveBeenCalledWith({ id: 'post-1', slug: ' New Slug ' });
    expect(postClient.publishPost).toHaveBeenCalledWith({ id: 'post-1' });
    expect(postClient.unpublishPost).toHaveBeenCalledWith({ id: 'post-1' });
    expect(postClient.archivePost).toHaveBeenCalledWith({ id: 'post-1' });
    expect(postClient.schedulePost).toHaveBeenCalledWith({
      id: 'post-1',
      scheduledAt: expect.objectContaining({ seconds: BigInt(1785911400) }),
      scheduledTimeZone: 'Asia/Seoul',
    });
    expect(postClient.cancelPostSchedule).toHaveBeenCalledWith({ id: 'post-1' });
    expect(postClient.republishPost).toHaveBeenCalledWith({ id: 'post-1' });
    expect(postClient.deletePost).toHaveBeenCalledWith({ id: 'post-1' });
    expect(postClient.deletePost).toHaveBeenCalledWith({ id: 'post-2' });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/posts');
  });

  it('maps media, taxonomy, member, share-link, OG, and markdown actions', async () => {
    await expect(actions.setPostFeaturedImageAction('post-1', 'file-1')).resolves.toEqual({
      imageUrl: 'https://cdn.example/post.webp',
      ogGenerationRunId: 'featured-run',
    });
    await expect(actions.removePostFeaturedImageAction('post-1')).resolves.toEqual({
      success: true,
      ogGenerationRunId: 'delete-featured-run',
    });
    await expect(actions.addPostAuthorAction('post-1', 'member-1')).resolves.toEqual({
      success: true,
    });
    await expect(actions.addPostCollaboratorAction('post-1', 'member-2')).resolves.toEqual({
      success: true,
    });
    await expect(actions.removePostAuthorAction('post-1', 'member-1')).resolves.toEqual({
      success: true,
    });
    await expect(actions.removePostCollaboratorAction('post-1', 'member-2')).resolves.toEqual({
      success: true,
    });
    await expect(actions.listPostShareLinksAction('post-1')).resolves.toEqual([{ id: 'share-1' }]);
    await expect(
      actions.createPostShareLinkAction({
        postId: 'post-1',
        label: 'Preview',
        password: 'preview-secret',
      }),
    ).resolves.toEqual({ shareLink: { id: 'share-1' } });
    await expect(actions.deletePostShareLinkAction('share-1')).resolves.toEqual({ success: true });
    await expect(actions.regeneratePostOgImageAction('post-1', ' ko ')).resolves.toEqual({
      success: true,
      runId: 'run-1',
      generationId: 'generation-1',
    });
    await expect(actions.getPostMarkdownAction('post-1')).resolves.toEqual({
      title: 'Post',
      markdown: '',
    });
    await expect(actions.exportPostMarkdownAction('post-1')).resolves.toEqual({ markdown: '' });

    expect(postClient.setPostFeaturedImage).toHaveBeenCalledWith({
      postId: 'post-1',
      fileId: 'file-1',
    });
    expect(postClient.addPostAuthor).toHaveBeenCalledWith({
      postId: 'post-1',
      memberId: 'member-1',
    });
    expect(postClient.addPostCollaborator).toHaveBeenCalledWith({
      postId: 'post-1',
      memberId: 'member-2',
    });
    expect(mocks.createShareLinkAction).toHaveBeenCalledWith(
      expect.any(Number),
      'post-1',
      expect.objectContaining({ password: 'preview-secret' }),
    );
    expect(mocks.regenerateOgImage).toHaveBeenCalledWith({
      entityType: OgEntityType.POST,
      entityId: 'post-1',
      selection: { target: { case: 'locale', value: 'ko' } },
    });
  });

  it('does not queue an unscoped OG regeneration', async () => {
    await expect(actions.regeneratePostOgImageAction('post-1', '')).resolves.toEqual({
      error: 'Locale is required to regenerate this OG image',
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

    await expect(actions.deletePostAdminAction('post-1')).resolves.toEqual({ success: true });
    await expect(actions.deletePostAction('post-2')).resolves.toEqual({ success: true });
    expect(postClient.deletePost).toHaveBeenCalledTimes(2);
  });

  it('returns user-facing authorization and backend errors', async () => {
    postClient.createPost.mockRejectedValueOnce(new ConnectError('missing auth', Code.Unauthenticated));
    await expect(actions.createPostAction()).resolves.toEqual({ error: 'Unauthorized' });

    postClient.deletePost.mockRejectedValueOnce(new ConnectError('denied', Code.PermissionDenied));
    await expect(actions.deletePostAdminAction('post-1')).resolves.toEqual({
      error: 'Unauthorized',
    });

    postClient.publishPost.mockRejectedValueOnce(new Error('backend down'));
    await expect(actions.publishPostAction('post-1')).resolves.toEqual({
      error: 'backend down',
    });
  });
});
