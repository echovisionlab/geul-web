import { Code, ConnectError } from '@connectrpc/connect';
import { create, fromJson } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { DocumentContentHeight, DocumentRegionPlacement } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { RichTextDocumentSchema, RichTextProfile } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { OgEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { ShareLinkEntityType } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
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

vi.mock('@/lib/queries/manifest', async () => {
  const { DEFAULT_SITE_SETTINGS_VIEW } = await import('@/lib/types/site-setting/config');
  return { getSettings: async () => DEFAULT_SITE_SETTINGS_VIEW };
});

vi.mock('@/lib/actions/share-link', () => ({
  createShareLinkAction: mocks.createShareLinkAction,
  deleteShareLinkAction: mocks.deleteShareLinkAction,
  listShareLinksAction: mocks.listShareLinksAction,
}));

describe('post actions', () => {
  it('forwards a scheduling origin as transport metadata alongside schedule intent', async () => {
    const origin = '40000000-0000-4000-8000-000000000002';
    await expect(
      actions.schedulePostAction('post-1', new Date('2026-10-15T00:00:00Z'), 'Asia/Seoul', origin),
    ).resolves.toEqual({ ok: true, success: true });
    expect(mocks.createPostClient).toHaveBeenCalledWith(origin);
    expect(postClient.schedulePost).toHaveBeenCalledWith({
      id: 'post-1',
      scheduledAt: timestampFromDate(new Date('2026-10-15T00:00:00Z')),
      scheduledTimeZone: 'Asia/Seoul',
    });
  });

  it.each([
    'publishPostAction',
    'unpublishPostAction',
    'archivePostAction',
    'cancelPostScheduleAction',
    'republishPostAction',
  ] as const)('forwards lifecycle origin for %s', async (action) => {
    const origin = '40000000-0000-4000-8000-000000000001';
    await expect(actions[action]('entity-1', origin)).resolves.toEqual({ ok: true, success: true });
    expect(mocks.createPostClient).toHaveBeenCalledWith(origin);
  });

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
  });

  it('creates a new post as an untitled draft with comments enabled', async () => {
    await expect(actions.createPostAction()).resolves.toEqual({ ok: true, data: { id: 'post-1' } });

    expect(postClient.createPost).toHaveBeenCalledWith({
      title: 'Untitled Post',
      commentsEnabled: true,
    });
  });

  it.each([
    {
      layout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow', hideTableOfContents: true } as const,
      expected: {
        contentHeight: DocumentContentHeight.VIEWPORT,
        pageChrome: DocumentRegionPlacement.PINNED,
        footer: DocumentRegionPlacement.FLOW,
        hideTableOfContents: true,
      },
    },
    {
      layout: { contentHeight: 'content', pageChrome: 'flow', footer: 'pinned' } as const,
      expected: {
        contentHeight: DocumentContentHeight.CONTENT,
        pageChrome: DocumentRegionPlacement.FLOW,
        footer: DocumentRegionPlacement.PINNED,
        hideTableOfContents: false,
      },
    },
  ])('saves the document layout $layout as the matching wire placement', async ({ layout, expected }) => {
    await actions.updatePostAction('post-1', { documentLayout: layout }, initialConfigurationRevision);

    expect(postClient.updatePost).toHaveBeenCalledWith(expect.objectContaining({ documentLayout: expected }));
  });

  it('clears the post map place and reports it as unset', async () => {
    const result = await actions.updatePostAction('post-1', { mapPlaceId: '' }, initialConfigurationRevision);

    expect(postClient.updatePost).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-1', mapPlaceId: '' }));
    expect(result).toMatchObject({ ok: true, configuration: { mapPlaceId: null } });
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

  it('returns the OG run started by a featured image change', async () => {
    await expect(actions.setPostFeaturedImageAction('post-1', 'file-1')).resolves.toEqual({
      ok: true,
      imageUrl: 'https://cdn.example/post.webp',
      ogGenerationRunId: 'featured-run',
    });
    await expect(actions.removePostFeaturedImageAction('post-1')).resolves.toEqual({
      ok: true,
      success: true,
      ogGenerationRunId: 'delete-featured-run',
    });
    expect(postClient.setPostFeaturedImage).toHaveBeenCalledWith({ postId: 'post-1', fileId: 'file-1' });
    expect(postClient.deletePostFeaturedImage).toHaveBeenCalledWith({ postId: 'post-1' });
  });

  it.each([
    { action: 'addPostAuthorAction', rpc: 'addPostAuthor', other: 'addPostCollaborator' },
    { action: 'addPostCollaboratorAction', rpc: 'addPostCollaborator', other: 'addPostAuthor' },
    { action: 'removePostAuthorAction', rpc: 'removePostAuthor', other: 'removePostCollaborator' },
    { action: 'removePostCollaboratorAction', rpc: 'removePostCollaborator', other: 'removePostAuthor' },
  ] as const)('$action changes only the $rpc membership', async ({ action, rpc, other }) => {
    await expect(actions[action]('post-1', 'member-1')).resolves.toEqual({ ok: true, success: true });

    expect(postClient[rpc]).toHaveBeenCalledWith({ postId: 'post-1', memberId: 'member-1' });
    expect(postClient[other]).not.toHaveBeenCalled();
  });

  it('creates a password-protected share link for the post', async () => {
    await expect(
      actions.createPostShareLinkAction({ postId: 'post-1', label: 'Preview', password: 'preview-secret' }),
    ).resolves.toEqual({ ok: true, shareLink: { id: 'share-1' } });

    expect(mocks.createShareLinkAction).toHaveBeenCalledWith(
      ShareLinkEntityType.POST,
      'post-1',
      expect.objectContaining({ label: 'Preview', password: 'preview-secret' }),
    );
  });

  it('regenerates the OG image for the trimmed requested locale', async () => {
    await expect(actions.regeneratePostOgImageAction('post-1', ' ko ')).resolves.toEqual({
      ok: true,
      success: true,
      runId: 'run-1',
      generationId: 'generation-1',
    });

    expect(mocks.regenerateOgImage).toHaveBeenCalledWith({
      entityType: OgEntityType.POST,
      entityId: 'post-1',
      selection: { target: { case: 'locale', value: 'ko' } },
    });
  });

  it('exports the stored post document as markdown', async () => {
    const blockId = '10000000-0000-4000-8000-000000000501';
    postClient.getPost.mockResolvedValue({
      id: 'post-1',
      title: 'Post',
      document: fromJson(RichTextDocumentSchema, {
        blockCatalogFingerprint: contentBlockCatalogFingerprint,
        profile: RichTextProfile.POST,
        sourceLocale: 'ko',
        base: { nodes: [{ block: { id: blockId, paragraph: { props: {} } }, placement: { index: 0 } }] },
        localeOverlays: [
          {
            locale: 'ko',
            blocks: [{ blockId, paragraph: { props: {}, content: [{ text: { text: 'Hello world' } }] } }],
          },
        ],
      }),
    });

    await expect(actions.getPostMarkdownAction('post-1')).resolves.toEqual({
      ok: true,
      title: 'Post',
      markdown: 'Hello world\n',
    });
    await expect(actions.exportPostMarkdownAction('post-1')).resolves.toEqual({
      ok: true,
      markdown: 'Hello world\n',
    });
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
