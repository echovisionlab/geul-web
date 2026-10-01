'use server';

import { connectActionErrorCode, isConnectError } from '@/lib/api/connect-error';
import {
  actionFailure,
  actionSuccess,
  type ActionResult,
  type LocalActionErrorCode,
} from '@/lib/actions/action-result';
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
import { normalizeOgRegenerationLocale } from '@/lib/utils/og-regeneration';

const revalidatePostAfterCommit = createCommittedMutationRevalidator('post-actions', 'post');

function postActionFailure(
  err: unknown,
  fallback: string,
  fallbackCode: LocalActionErrorCode,
  unauthorizedCodes: readonly Code[] = [Code.Unauthenticated],
) {
  const message =
    isConnectError(err) && unauthorizedCodes.includes(err.code)
      ? 'Unauthorized'
      : err instanceof Error
        ? err.message
        : fallback;
  return actionFailure(message.trim() ? message : fallback, connectActionErrorCode(err, fallbackCode));
}

function toProtoDocumentLayout(layout: DocumentLayout) {
  return {
    contentHeight: layout.contentHeight === 'viewport' ? DocumentContentHeight.VIEWPORT : DocumentContentHeight.CONTENT,
    pageChrome: layout.pageChrome === 'pinned' ? DocumentRegionPlacement.PINNED : DocumentRegionPlacement.FLOW,
    footer: layout.footer === 'pinned' ? DocumentRegionPlacement.PINNED : DocumentRegionPlacement.FLOW,
  };
}

export async function createPostAction(): Promise<ActionResult<{ data: { id: string } }>> {
  try {
    const client = await createPostClient();
    const response = await client.createPost({
      title: 'Untitled Post',
      commentsEnabled: true,
    });
    revalidatePath('/admin/posts');
    return actionSuccess({ data: { id: response.id } });
  } catch (err) {
    return postActionFailure(err, 'Failed to create post', 'POST_CREATE_FAILED');
  }
}

export async function deletePostAdminAction(id: string): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createPostClient();
    await client.deletePost({ id });
    revalidatePostAfterCommit('/admin/posts');
    return actionSuccess({ success: true });
  } catch (err) {
    return postActionFailure(err, 'Failed to delete post', 'POST_DELETE_FAILED', [
      Code.Unauthenticated,
      Code.PermissionDenied,
    ]);
  }
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
): Promise<ActionResult<{ success: true; configurationRevision: string; configuration: PostConfigurationSnapshot }>> {
  try {
    const client = await createPostClient();
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
    return actionSuccess({ success: true, configurationRevision: configuration.configurationRevision, configuration });
  } catch (err) {
    return postActionFailure(err, 'Failed to update post', 'POST_UPDATE_FAILED');
  }
}

export async function getPostConfigurationAction(
  postId: string,
): Promise<ActionResult<{ configuration: PostConfigurationSnapshot }>> {
  try {
    const client = await createPostClient();
    const response = await client.getPost({ id: postId });
    return actionSuccess({ configuration: postConfigurationSnapshot(response) });
  } catch (err) {
    return postActionFailure(err, 'Failed to load Post settings', 'POST_UPDATE_FAILED');
  }
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
  try {
    const client = await createPostClient();
    await client.deletePost({ id: postId });
    revalidatePostAfterCommit('/admin/posts');
    return actionSuccess({ success: true });
  } catch (err) {
    return postActionFailure(err, 'Failed to delete post', 'POST_DELETE_FAILED');
  }
}

export async function publishPostAction(postId: string): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createPostClient();
    await client.publishPost({ id: postId });
    return actionSuccess({ success: true });
  } catch (err) {
    return postActionFailure(err, 'Failed to publish post', 'POST_PUBLISH_FAILED');
  }
}

export async function unpublishPostAction(postId: string): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createPostClient();
    await client.unpublishPost({ id: postId });
    return actionSuccess({ success: true });
  } catch (err) {
    return postActionFailure(err, 'Failed to unpublish post', 'POST_UNPUBLISH_FAILED');
  }
}

export async function archivePostAction(postId: string): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createPostClient();
    await client.archivePost({ id: postId });
    return actionSuccess({ success: true });
  } catch (err) {
    return postActionFailure(err, 'Failed to archive post', 'POST_ARCHIVE_FAILED');
  }
}

export async function schedulePostAction(
  postId: string,
  scheduledAt: Date,
  scheduledTimeZone: string,
): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createPostClient();
    await client.schedulePost({
      id: postId,
      scheduledAt: timestampFromDate(scheduledAt),
      scheduledTimeZone,
    });
    return actionSuccess({ success: true });
  } catch (err) {
    return postActionFailure(err, 'Failed to schedule post', 'POST_SCHEDULE_FAILED');
  }
}

export async function cancelPostScheduleAction(postId: string): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createPostClient();
    await client.cancelPostSchedule({ id: postId });
    return actionSuccess({ success: true });
  } catch (err) {
    return postActionFailure(err, 'Failed to cancel post schedule', 'POST_CANCEL_SCHEDULE_FAILED');
  }
}

export async function republishPostAction(postId: string): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createPostClient();
    await client.republishPost({ id: postId });
    return actionSuccess({ success: true });
  } catch (err) {
    return postActionFailure(err, 'Failed to republish post', 'POST_REPUBLISH_FAILED');
  }
}

export async function setPostFeaturedImageAction(
  postId: string,
  fileId: string,
): Promise<ActionResult<{ imageUrl: string | undefined; ogGenerationRunId?: string }>> {
  try {
    const client = await createPostClient();
    const result = await client.setPostFeaturedImage({ postId, fileId });
    const response = { imageUrl: resolvePostFeaturedImageUrl(result.imageDelivery) ?? undefined };
    return actionSuccess(
      result.ogGenerationRunId ? { ...response, ogGenerationRunId: result.ogGenerationRunId } : response,
    );
  } catch (err) {
    return postActionFailure(err, 'Failed to set featured image', 'POST_SET_FEATURED_IMAGE_FAILED');
  }
}

export async function removePostFeaturedImageAction(
  postId: string,
): Promise<ActionResult<{ success: true; ogGenerationRunId?: string }>> {
  try {
    const client = await createPostClient();
    const result = await client.deletePostFeaturedImage({ postId });
    return actionSuccess(
      result.ogGenerationRunId ? { success: true, ogGenerationRunId: result.ogGenerationRunId } : { success: true },
    );
  } catch (err) {
    return postActionFailure(err, 'Failed to remove featured image', 'POST_REMOVE_FEATURED_IMAGE_FAILED');
  }
}

// === Authors and collaborators ===

export async function addPostAuthorAction(postId: string, memberId: string): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createPostClient();
    await client.addPostAuthor({ postId, memberId });
    return actionSuccess({ success: true });
  } catch (err) {
    return postActionFailure(err, 'Failed to add author', 'POST_ADD_AUTHOR_FAILED');
  }
}

export async function removePostAuthorAction(
  postId: string,
  memberId: string,
): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createPostClient();
    await client.removePostAuthor({ postId, memberId });
    return actionSuccess({ success: true });
  } catch (err) {
    return postActionFailure(err, 'Failed to remove author', 'POST_REMOVE_AUTHOR_FAILED');
  }
}

export async function addPostCollaboratorAction(
  postId: string,
  memberId: string,
): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createPostClient();
    await client.addPostCollaborator({ postId, memberId });
    return actionSuccess({ success: true });
  } catch (err) {
    return postActionFailure(err, 'Failed to add collaborator', 'POST_ADD_COLLABORATOR_FAILED');
  }
}

export async function removePostCollaboratorAction(
  postId: string,
  memberId: string,
): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createPostClient();
    await client.removePostCollaborator({ postId, memberId });
    return actionSuccess({ success: true });
  } catch (err) {
    return postActionFailure(err, 'Failed to remove collaborator', 'POST_REMOVE_COLLABORATOR_FAILED');
  }
}

// Share links - delegate to ShareLink service
export async function listPostShareLinksAction(postId: string): Promise<ShareLinkItem[]> {
  return listShareLinksAction(ShareLinkEntityType.POST, postId);
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
  return {
    title: post.title,
    markdown: generatedRichTextDocumentMarkdown(post.document, post.id),
  };
}

// Markdown export stays server-side because it reads the canonical Block document.
export async function getPostMarkdownAction(
  postId: string,
): Promise<ActionResult<{ title: string; markdown: string }>> {
  try {
    return actionSuccess(await getGeneratedPostMarkdown(postId));
  } catch (err) {
    return postActionFailure(err, 'Failed to get markdown', 'POST_GET_MARKDOWN_FAILED', []);
  }
}

export async function exportPostMarkdownAction(postId: string): Promise<ActionResult<{ markdown: string }>> {
  try {
    const result = await getGeneratedPostMarkdown(postId);
    return actionSuccess({ markdown: result.markdown });
  } catch (err) {
    return postActionFailure(err, 'Failed to export markdown', 'POST_EXPORT_MARKDOWN_FAILED', []);
  }
}
