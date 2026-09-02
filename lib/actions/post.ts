'use server';

import { isConnectError } from '@/lib/api/connect-error';
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
import { normalizeOgRegenerationLocale } from '@/lib/utils/og-regeneration';
import { toSlugInputValue } from '@/lib/utils/slug';

const revalidatePostAfterCommit = createCommittedMutationRevalidator('post-actions', 'post');

function toProtoDocumentLayout(layout: DocumentLayout) {
  return {
    contentHeight: layout.contentHeight === 'viewport' ? DocumentContentHeight.VIEWPORT : DocumentContentHeight.CONTENT,
    pageChrome: layout.pageChrome === 'pinned' ? DocumentRegionPlacement.PINNED : DocumentRegionPlacement.FLOW,
    footer: layout.footer === 'pinned' ? DocumentRegionPlacement.PINNED : DocumentRegionPlacement.FLOW,
  };
}

export async function createPostAction(): Promise<{ data?: { id: string }; error?: string }> {
  try {
    const client = await createPostClient();
    const response = await client.createPost({
      title: 'Untitled Post',
      commentsEnabled: true,
    });
    revalidatePath('/admin/posts');
    return { data: { id: response.id } };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create post' };
  }
}

export async function deletePostAdminAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPostClient();
    await client.deletePost({ id });
    revalidatePostAfterCommit('/admin/posts');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated || err.code === Code.PermissionDenied) {
        return { error: 'Unauthorized' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete post' };
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
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPostClient();
    const request: {
      id: string;
      slug?: string;
      commentsEnabled?: boolean;
      mapPlaceId?: string;
      documentLayout?: ReturnType<typeof toProtoDocumentLayout>;
    } = { id: postId };

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

    await client.updatePost(request);
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update post' };
  }
}

export async function updatePostSlugAction(
  postId: string,
  slug: string | null,
): Promise<{ success?: boolean; slug?: string | null; error?: string }> {
  const result = await updatePostAction(postId, { slug: toSlugInputValue(slug) });

  if (result.error) {
    return { error: result.error };
  }

  return { success: true, slug };
}

export async function deletePostAction(postId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPostClient();
    await client.deletePost({ id: postId });
    revalidatePostAfterCommit('/admin/posts');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete post' };
  }
}

export async function publishPostAction(postId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPostClient();
    await client.publishPost({ id: postId });
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to publish post' };
  }
}

export async function unpublishPostAction(postId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPostClient();
    await client.unpublishPost({ id: postId });
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to unpublish post' };
  }
}

export async function archivePostAction(postId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPostClient();
    await client.archivePost({ id: postId });
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to archive post' };
  }
}

export async function schedulePostAction(
  postId: string,
  scheduledAt: Date,
  scheduledTimeZone: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPostClient();
    await client.schedulePost({
      id: postId,
      scheduledAt: timestampFromDate(scheduledAt),
      scheduledTimeZone,
    });
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to schedule post' };
  }
}

export async function cancelPostScheduleAction(postId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPostClient();
    await client.cancelPostSchedule({ id: postId });
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to cancel post schedule' };
  }
}

export async function republishPostAction(postId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPostClient();
    await client.republishPost({ id: postId });
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to republish post' };
  }
}

export async function setPostFeaturedImageAction(
  postId: string,
  fileId: string,
): Promise<{ imageUrl?: string; ogGenerationRunId?: string; error?: string }> {
  try {
    const client = await createPostClient();
    const result = await client.setPostFeaturedImage({ postId, fileId });
    const response = { imageUrl: resolvePostFeaturedImageUrl(result.imageDelivery) ?? undefined };
    return result.ogGenerationRunId ? { ...response, ogGenerationRunId: result.ogGenerationRunId } : response;
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to set featured image' };
  }
}

export async function removePostFeaturedImageAction(
  postId: string,
): Promise<{ success?: boolean; ogGenerationRunId?: string; error?: string }> {
  try {
    const client = await createPostClient();
    const result = await client.deletePostFeaturedImage({ postId });
    return result.ogGenerationRunId
      ? { success: true, ogGenerationRunId: result.ogGenerationRunId }
      : { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to remove featured image' };
  }
}

// === Authors and collaborators ===

export async function addPostAuthorAction(
  postId: string,
  memberId: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPostClient();
    await client.addPostAuthor({ postId, memberId });
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to add author' };
  }
}

export async function removePostAuthorAction(
  postId: string,
  memberId: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPostClient();
    await client.removePostAuthor({ postId, memberId });
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to remove author' };
  }
}

export async function addPostCollaboratorAction(
  postId: string,
  memberId: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPostClient();
    await client.addPostCollaborator({ postId, memberId });
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to add collaborator' };
  }
}

export async function removePostCollaboratorAction(
  postId: string,
  memberId: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPostClient();
    await client.removePostCollaborator({ postId, memberId });
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to remove collaborator' };
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
}): Promise<{ shareLink?: ShareLinkItem; error?: string }> {
  return createShareLinkAction(ShareLinkEntityType.POST, data.postId, {
    label: data.label,
    expiresAt: data.expiresAt,
    password: data.password,
  });
}

export async function deletePostShareLinkAction(id: string): Promise<{ success?: boolean; error?: string }> {
  return deleteShareLinkAction(id);
}

export async function regeneratePostOgImageAction(
  postId: string,
  locale: string,
): Promise<{ success?: boolean; runId?: string; generationId?: string; error?: string }> {
  const scopedLocale = normalizeOgRegenerationLocale(locale);
  if (!scopedLocale) {
    return { error: 'Locale is required to regenerate this OG image' };
  }

  const result = await requestOgImageRegeneration({
    entityType: 'post',
    entityId: postId,
    selection: { type: 'locale', locale: scopedLocale },
  });
  if (result.error) {
    return { error: result.error };
  }
  return { success: true, runId: result.runId, generationId: result.generationIds?.[0] };
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
): Promise<{ title?: string | null; markdown?: string; error?: string }> {
  try {
    return await getGeneratedPostMarkdown(postId);
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to get markdown' };
  }
}

export async function exportPostMarkdownAction(postId: string): Promise<{ markdown?: string; error?: string }> {
  try {
    const result = await getGeneratedPostMarkdown(postId);
    return { markdown: result.markdown };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to export markdown' };
  }
}
