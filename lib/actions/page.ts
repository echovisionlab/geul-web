'use server';

import { isConnectError } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { Code } from '@connectrpc/connect';
import { ShareLinkEntityType, type ShareLinkItem } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import { createShareLinkAction, deleteShareLinkAction, listShareLinksAction } from '@/lib/actions/share-link';
import { regenerateOgImageAction as requestOgImageRegeneration } from '@/lib/actions/og-generation';
import { createCommittedMutationRevalidator } from '@/lib/actions/revalidate-after-commit';
import { createPageClient } from '@/lib/api/server-client';
import { resolveFeaturedImageDeliveryUrl } from '@/lib/media/post-featured-image';
import { normalizeOgRegenerationLocale } from '@/lib/utils/og-regeneration';
import { getPageSlugValidationReason, type PageSlugValidationReason } from '@/lib/utils/page-route';
import { toSlugInputValue } from '@/lib/utils/slug';

const revalidatePageAfterCommit = createCommittedMutationRevalidator('page-actions', 'page');

export async function createPageAction(): Promise<{ data?: { id: string; slug: string | null }; error?: string }> {
  try {
    const client = await createPageClient();
    const page = await client.createPage({
      title: 'Untitled Page',
    });
    revalidatePath('/admin/pages');
    return { data: { id: page.id, slug: page.slug ?? null } };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create page' };
  }
}

export async function deletePageAdminAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPageClient();
    await client.deletePage({ id });
    revalidatePageAfterCommit('/admin/pages');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete page' };
  }
}

// === Editor Mutations ===

export async function publishPageAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPageClient();
    await client.publishPage({ id });
    revalidatePath('/admin/pages');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to publish page' };
  }
}

export async function unpublishPageAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPageClient();
    await client.unpublishPage({ id });
    revalidatePath('/admin/pages');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to unpublish page' };
  }
}

export async function updatePageShowTitleAction(
  id: string,
  showTitle: boolean,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPageClient();
    await client.updatePage({ id, showTitle });
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update page show title' };
  }
}

export async function updatePageSlugAction(
  id: string,
  slug: string | null,
): Promise<{
  success?: boolean;
  slug?: string | null;
  error?: string;
  reason?: PageSlugValidationReason | 'alreadyExists' | 'checkFailed';
}> {
  try {
    const client = await createPageClient();
    await client.updatePage({ id, slug: toSlugInputValue(slug) });
    revalidatePath('/admin/pages');
    return { success: true, slug };
  } catch (err) {
    if (isConnectError(err)) {
      const reason =
        err.code === Code.AlreadyExists
          ? 'alreadyExists'
          : err.code === Code.InvalidArgument
            ? slug
              ? (getPageSlugValidationReason(slug) ?? 'invalidPath')
              : 'invalidPath'
            : 'checkFailed';
      return { error: err.message, reason };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update page slug', reason: 'checkFailed' };
  }
}

// Share links - uses generic ShareLinkService
export async function listPageShareLinksAction(pageId: string): Promise<ShareLinkItem[]> {
  return listShareLinksAction(ShareLinkEntityType.PAGE, pageId);
}

export async function createPageShareLinkAction(data: {
  pageId: string;
  label?: string;
  expiresAt?: Date;
  password?: string;
}): Promise<{ shareLink?: ShareLinkItem; error?: string }> {
  return createShareLinkAction(ShareLinkEntityType.PAGE, data.pageId, {
    label: data.label,
    expiresAt: data.expiresAt,
    password: data.password,
  });
}

export async function deletePageShareLinkAction(id: string): Promise<{ success?: boolean; error?: string }> {
  return deleteShareLinkAction(id);
}

export async function regeneratePageOgImageAction(
  pageId: string,
  locale: string,
): Promise<{ success?: boolean; runId?: string; generationId?: string; error?: string }> {
  const scopedLocale = normalizeOgRegenerationLocale(locale);
  if (!scopedLocale) {
    return { error: 'Locale is required to regenerate this OG image' };
  }

  const result = await requestOgImageRegeneration({
    entityType: 'page',
    entityId: pageId,
    selection: { type: 'locale', locale: scopedLocale },
  });
  if (result.error) {
    return { error: result.error };
  }
  return { success: true, runId: result.runId, generationId: result.generationIds?.[0] };
}

export async function setPageFeaturedImageAction(
  pageId: string,
  fileId: string,
): Promise<{ imageUrl?: string; ogGenerationRunId?: string; error?: string }> {
  try {
    const client = await createPageClient();
    const result = await client.setPageFeaturedImage({ pageId, fileId });
    const imageUrl = resolveFeaturedImageDeliveryUrl(result.imageDelivery);
    const response = imageUrl ? { imageUrl } : {};
    return result.ogGenerationRunId ? { ...response, ogGenerationRunId: result.ogGenerationRunId } : response;
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to set featured image' };
  }
}

export async function removePageFeaturedImageAction(
  pageId: string,
): Promise<{ success?: boolean; ogGenerationRunId?: string; error?: string }> {
  try {
    const client = await createPageClient();
    const result = await client.deletePageFeaturedImage({ pageId });
    return result.ogGenerationRunId
      ? { success: true, ogGenerationRunId: result.ogGenerationRunId }
      : { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to remove featured image' };
  }
}
