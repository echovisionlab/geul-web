'use server';

import { getSettings } from '@/lib/queries/manifest';
import { siteVariableContext } from '@/lib/site-variables';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { actionFailure, actionSuccess, type ActionResult } from '@/lib/actions/action-result';
import { runAction } from '@/lib/actions/run-action';
import { revalidatePath } from 'next/cache';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import type { DocumentLayout } from '@echovisionlab/geul-common/collaboration/document-layout';
import { DocumentContentHeight, DocumentRegionPlacement } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { ShareLinkEntityType, type ShareLinkItem } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import { createShareLinkAction, deleteShareLinkAction, listShareLinksAction } from '@/lib/actions/share-link';
import { regenerateOgImageAction as requestOgImageRegeneration } from '@/lib/actions/og-generation';
import { createCommittedMutationRevalidator } from '@/lib/actions/revalidate-after-commit';
import { createPostClient } from '@/lib/api/server-client';
import { resolvePostFeaturedImageUrl } from '@/lib/media/post-featured-image';
import { mapProtoDocumentLayout } from '@/lib/queries/document-layout';
import type { PostConfigurationSnapshot } from '@/lib/types/post/model';
import { toCdnUrl } from '@/lib/utils/file-url';
import { normalizeOgRegenerationLocale } from '@/lib/utils/og-regeneration';

const revalidatePostAfterCommit = createCommittedMutationRevalidator('post-actions', 'post');

function toProtoDocumentLayout(layout: DocumentLayout) {
  return {
    contentHeight: layout.contentHeight === 'viewport' ? DocumentContentHeight.VIEWPORT : DocumentContentHeight.CONTENT,
    pageChrome: layout.pageChrome === 'pinned' ? DocumentRegionPlacement.PINNED : DocumentRegionPlacement.FLOW,
    footer: layout.footer === 'pinned' ? DocumentRegionPlacement.PINNED : DocumentRegionPlacement.FLOW,
    hideTableOfContents: layout.hideTableOfContents ?? false,
  };
}

export async function createPostAction(): Promise<ActionResult<{ data: { id: string } }>> {
  return runAction(
    'post-actions',
    'createPostAction',
    async () => {
      const client = await createPostClient();
      const response = await client.createPost({
        title: 'Untitled Post',
        commentsEnabled: true,
      });
      revalidatePath('/admin/posts');
      return { data: { id: response.id } };
    },
    { fallback: 'Failed to create post', code: 'POST_CREATE_FAILED' },
  );
}

export async function deletePostAdminAction(id: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'post-actions',
    'deletePostAdminAction',
    async () => {
      const client = await createPostClient();
      await client.deletePost({ id });
      revalidatePostAfterCommit('/admin/posts');
      return { success: true as const };
    },
    {
      fallback: 'Failed to delete post',
      code: 'POST_DELETE_FAILED',
      messages: { [Code.PermissionDenied]: 'Unauthorized' },
    },
  );
}

export async function updatePostAction(
  postId: string,
  data: {
    slug?: string;
    commentsEnabled?: boolean;
    mapPlaceId?: string;
    documentLayout?: DocumentLayout;
  },
  expectedConfigurationRevision: string,
  editorOrigin?: string,
): Promise<ActionResult<{ success: true; configurationRevision: string; configuration: PostConfigurationSnapshot }>> {
  return runAction(
    'post-actions',
    'updatePostAction',
    async () => {
      const client = await createPostClient(editorOrigin);
      const request: {
        id: string;
        expectedConfigurationRevision: string;
        slug?: string;
        commentsEnabled?: boolean;
        mapPlaceId?: string;
        documentLayout?: ReturnType<typeof toProtoDocumentLayout>;
      } = { id: postId, expectedConfigurationRevision };

      if ('slug' in data) {
        request.slug = data.slug;
      }
      if ('commentsEnabled' in data) {
        request.commentsEnabled = data.commentsEnabled;
      }
      if ('mapPlaceId' in data) {
        request.mapPlaceId = data.mapPlaceId;
      }
      if ('documentLayout' in data && data.documentLayout) {
        request.documentLayout = toProtoDocumentLayout(data.documentLayout);
      }

      const response = await client.updatePost(request);
      const configuration = postConfigurationSnapshot(response);
      return { success: true as const, configurationRevision: configuration.configurationRevision, configuration };
    },
    { fallback: 'Failed to update post', code: 'POST_UPDATE_FAILED' },
  );
}

export async function getPostConfigurationAction(
  postId: string,
): Promise<ActionResult<{ configuration: PostConfigurationSnapshot }>> {
  return runAction(
    'post-actions',
    'getPostConfigurationAction',
    async () => {
      const client = await createPostClient();
      const response = await client.getPost({ id: postId });
      return { configuration: postConfigurationSnapshot(response) };
    },
    { fallback: 'Failed to load Post settings', code: 'POST_UPDATE_FAILED' },
  );
}

function postConfigurationSnapshot(post: {
  configurationRevision: string;
  slug?: string;
  commentsEnabled: boolean;
  mapPlaceId?: string;
  documentLayout?: Parameters<typeof mapProtoDocumentLayout>[0];
}): PostConfigurationSnapshot {
  return {
    configurationRevision: post.configurationRevision,
    slug: post.slug ?? null,
    commentsEnabled: post.commentsEnabled,
    mapPlaceId: post.mapPlaceId ?? null,
    documentLayout: mapProtoDocumentLayout(post.documentLayout),
  };
}

export async function deletePostAction(postId: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'post-actions',
    'deletePostAction',
    async () => {
      const client = await createPostClient();
      await client.deletePost({ id: postId });
      revalidatePostAfterCommit('/admin/posts');
      return { success: true as const };
    },
    { fallback: 'Failed to delete post', code: 'POST_DELETE_FAILED' },
  );
}

export async function publishPostAction(
  postId: string,
  editorOrigin?: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'post-actions',
    'publishPostAction',
    async () => {
      const client = await createPostClient(editorOrigin);
      await client.publishPost({ id: postId });
      return { success: true as const };
    },
    { fallback: 'Failed to publish post', code: 'POST_PUBLISH_FAILED' },
  );
}

export async function unpublishPostAction(
  postId: string,
  editorOrigin?: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'post-actions',
    'unpublishPostAction',
    async () => {
      const client = await createPostClient(editorOrigin);
      await client.unpublishPost({ id: postId });
      return { success: true as const };
    },
    { fallback: 'Failed to unpublish post', code: 'POST_UNPUBLISH_FAILED' },
  );
}

export async function archivePostAction(
  postId: string,
  editorOrigin?: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'post-actions',
    'archivePostAction',
    async () => {
      const client = await createPostClient(editorOrigin);
      await client.archivePost({ id: postId });
      return { success: true as const };
    },
    { fallback: 'Failed to archive post', code: 'POST_ARCHIVE_FAILED' },
  );
}

export async function schedulePostAction(
  postId: string,
  scheduledAt: Date,
  scheduledTimeZone: string,
  editorOrigin?: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'post-actions',
    'schedulePostAction',
    async () => {
      const client = await createPostClient(editorOrigin);
      await client.schedulePost({
        id: postId,
        scheduledAt: timestampFromDate(scheduledAt),
        scheduledTimeZone,
      });
      return { success: true as const };
    },
    { fallback: 'Failed to schedule post', code: 'POST_SCHEDULE_FAILED' },
  );
}

export async function cancelPostScheduleAction(
  postId: string,
  editorOrigin?: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'post-actions',
    'cancelPostScheduleAction',
    async () => {
      const client = await createPostClient(editorOrigin);
      await client.cancelPostSchedule({ id: postId });
      return { success: true as const };
    },
    { fallback: 'Failed to cancel post schedule', code: 'POST_CANCEL_SCHEDULE_FAILED' },
  );
}

export async function republishPostAction(
  postId: string,
  editorOrigin?: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'post-actions',
    'republishPostAction',
    async () => {
      const client = await createPostClient(editorOrigin);
      await client.republishPost({ id: postId });
      return { success: true as const };
    },
    { fallback: 'Failed to republish post', code: 'POST_REPUBLISH_FAILED' },
  );
}

export async function setPostFeaturedImageAction(
  postId: string,
  fileId: string,
): Promise<ActionResult<{ imageUrl: string | undefined; ogGenerationRunId?: string }>> {
  return runAction(
    'post-actions',
    'setPostFeaturedImageAction',
    async () => {
      const client = await createPostClient();
      const result = await client.setPostFeaturedImage({ postId, fileId });
      const response = { imageUrl: resolvePostFeaturedImageUrl(result.imageDelivery) ?? undefined };
      return result.ogGenerationRunId ? { ...response, ogGenerationRunId: result.ogGenerationRunId } : response;
    },
    { fallback: 'Failed to set featured image', code: 'POST_SET_FEATURED_IMAGE_FAILED' },
  );
}

export async function removePostFeaturedImageAction(
  postId: string,
): Promise<ActionResult<{ success: true; ogGenerationRunId?: string }>> {
  return runAction(
    'post-actions',
    'removePostFeaturedImageAction',
    async () => {
      const client = await createPostClient();
      const result = await client.deletePostFeaturedImage({ postId });
      return result.ogGenerationRunId
        ? { success: true as const, ogGenerationRunId: result.ogGenerationRunId }
        : { success: true as const };
    },
    { fallback: 'Failed to remove featured image', code: 'POST_REMOVE_FEATURED_IMAGE_FAILED' },
  );
}

// === Authors and collaborators ===

export async function addPostAuthorAction(postId: string, memberId: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'post-actions',
    'addPostAuthorAction',
    async () => {
      const client = await createPostClient();
      await client.addPostAuthor({ postId, memberId });
      return { success: true as const };
    },
    { fallback: 'Failed to add author', code: 'POST_ADD_AUTHOR_FAILED' },
  );
}

export async function removePostAuthorAction(
  postId: string,
  memberId: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'post-actions',
    'removePostAuthorAction',
    async () => {
      const client = await createPostClient();
      await client.removePostAuthor({ postId, memberId });
      return { success: true as const };
    },
    { fallback: 'Failed to remove author', code: 'POST_REMOVE_AUTHOR_FAILED' },
  );
}

export async function addPostCollaboratorAction(
  postId: string,
  memberId: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'post-actions',
    'addPostCollaboratorAction',
    async () => {
      const client = await createPostClient();
      await client.addPostCollaborator({ postId, memberId });
      return { success: true as const };
    },
    { fallback: 'Failed to add collaborator', code: 'POST_ADD_COLLABORATOR_FAILED' },
  );
}

export async function removePostCollaboratorAction(
  postId: string,
  memberId: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'post-actions',
    'removePostCollaboratorAction',
    async () => {
      const client = await createPostClient();
      await client.removePostCollaborator({ postId, memberId });
      return { success: true as const };
    },
    { fallback: 'Failed to remove collaborator', code: 'POST_REMOVE_COLLABORATOR_FAILED' },
  );
}

// Share links - delegate to ShareLink service
export async function listPostShareLinksAction(postId: string): Promise<ShareLinkItem[]> {
  return listShareLinksAction(ShareLinkEntityType.POST, postId).then(unwrapQueryResult);
}

export async function createPostShareLinkAction(data: {
  postId: string;
  label?: string;
  expiresAt?: Date;
  password?: string;
}): Promise<ActionResult<{ shareLink: ShareLinkItem }>> {
  return createShareLinkAction(ShareLinkEntityType.POST, data.postId, {
    label: data.label,
    expiresAt: data.expiresAt,
    password: data.password,
  });
}

export async function deletePostShareLinkAction(id: string): Promise<ActionResult<{ success: true }>> {
  return deleteShareLinkAction(id);
}

export async function regeneratePostOgImageAction(
  postId: string,
  locale: string,
): Promise<ActionResult<{ success: true; runId?: string; generationId?: string }>> {
  const scopedLocale = normalizeOgRegenerationLocale(locale);
  if (!scopedLocale) {
    return actionFailure('Locale is required to regenerate this OG image', 'ACTION_INVALID_LOCALE');
  }

  const result = await requestOgImageRegeneration({
    entityType: 'post',
    entityId: postId,
    selection: { type: 'locale', locale: scopedLocale },
  });
  if (!result.ok) {
    return actionFailure(result.error, result.errorCode);
  }
  return actionSuccess({ success: true, runId: result.runId, generationId: result.generationIds?.[0] });
}

async function getGeneratedPostMarkdown(postId: string): Promise<{ title: string; markdown: string }> {
  const { createPostClient } = await import('@/lib/api/server-client');
  const client = await createPostClient();
  const post = await client.getPost({ id: postId });
  if (!post.document) {
    throw new Error('Post Block document is missing.');
  }
  const { generatedRichTextDocumentMarkdown } = await import('@/lib/convert/generated-rich-text-markdown');
  const settings = await getSettings();
  return {
    title: post.title,
    markdown: generatedRichTextDocumentMarkdown(post.document, post.id, siteVariableContext(settings), {
      blockMedia: post.blockMedia,
      absoluteUrl: (path) => {
        const url = toCdnUrl(path);
        return url.startsWith('/') && URL.canParse(url, settings.site_origin)
          ? new URL(url, settings.site_origin).href
          : url;
      },
    }),
  };
}

// Markdown export stays server-side because it reads the canonical Block document.
export async function getPostMarkdownAction(
  postId: string,
): Promise<ActionResult<{ title: string; markdown: string }>> {
  return runAction(
    'post-actions',
    'getPostMarkdownAction',
    async () => {
      return await getGeneratedPostMarkdown(postId);
    },
    { fallback: 'Failed to get markdown', code: 'POST_GET_MARKDOWN_FAILED' },
  );
}

export async function exportPostMarkdownAction(postId: string): Promise<ActionResult<{ markdown: string }>> {
  return runAction(
    'post-actions',
    'exportPostMarkdownAction',
    async () => {
      const result = await getGeneratedPostMarkdown(postId);
      return { markdown: result.markdown };
    },
    { fallback: 'Failed to export markdown', code: 'POST_EXPORT_MARKDOWN_FAILED' },
  );
}
