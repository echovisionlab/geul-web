'use server';

import { connectActionErrorCode, isConnectError } from '@/lib/api/connect-error';
import {
  actionFailure,
  actionSuccess,
  type ActionResult,
  type LocalActionErrorCode,
} from '@/lib/actions/action-result';
import { revalidatePath } from 'next/cache';
import { Code } from '@connectrpc/connect';
import { ShareLinkEntityType, type ShareLinkItem } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import { PageStatus } from '@echovisionlab/geul-proto/secure/page_pb.ts';
import { createShareLinkAction, deleteShareLinkAction, listShareLinksAction } from '@/lib/actions/share-link';
import { regenerateOgImageAction as requestOgImageRegeneration } from '@/lib/actions/og-generation';
import { createCommittedMutationRevalidator } from '@/lib/actions/revalidate-after-commit';
import { createPageClient } from '@/lib/api/server-client';
import { resolveFeaturedImageDeliveryUrl } from '@/lib/media/post-featured-image';
import { normalizeOgRegenerationLocale } from '@/lib/utils/og-regeneration';
import { getPageSlugValidationReason, type PageSlugValidationReason } from '@/lib/utils/page-route';
import { toSlugInputValue } from '@/lib/utils/slug';

const revalidatePageAfterCommit = createCommittedMutationRevalidator('page-actions', 'page');

type PageLifecycleStatus = 'draft' | 'published';

function pageLifecycleStatus(status: PageStatus): PageLifecycleStatus {
  switch (status) {
    case PageStatus.DRAFT:
      return 'draft';
    case PageStatus.PUBLISHED:
      return 'published';
    default:
      throw new Error('Page service returned an unsupported lifecycle status');
  }
}

function pageActionFailure(err: unknown, fallback: string, fallbackCode: LocalActionErrorCode) {
  const message = err instanceof Error ? err.message : fallback;
  return actionFailure(message.trim() ? message : fallback, connectActionErrorCode(err, fallbackCode));
}

export async function createPageAction(): Promise<ActionResult<{ data: { id: string; slug: string | null } }>> {
  try {
    const client = await createPageClient();
    const page = await client.createPage({
      title: 'Untitled Page',
    });
    revalidatePath('/admin/pages');
    return actionSuccess({ data: { id: page.id, slug: page.slug ?? null } });
  } catch (err) {
    return pageActionFailure(err, 'Failed to create page', 'PAGE_CREATE_FAILED');
  }
}

export async function deletePageAdminAction(id: string): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createPageClient();
    await client.deletePage({ id });
    revalidatePageAfterCommit('/admin/pages');
    return actionSuccess({ success: true });
  } catch (err) {
    return pageActionFailure(err, 'Failed to delete page', 'PAGE_DELETE_FAILED');
  }
}

// === Editor Mutations ===

export async function getPageNeutralConfigurationAction(
  id: string,
): Promise<ActionResult<{ slug: string | null; showTitle: boolean; status: PageLifecycleStatus }>> {
  try {
    const client = await createPageClient();
    const page = await client.getPage({ id });
    return actionSuccess({
      slug: page.slug || null,
      showTitle: page.showTitle,
      status: pageLifecycleStatus(page.status),
    });
  } catch (err) {
    return actionFailure(
      err instanceof Error ? err.message : 'Failed to load page editor configuration',
      isConnectError(err) ? err.code : Code.Internal,
    );
  }
}

export async function publishPageAction(
  id: string,
): Promise<ActionResult<{ success: true; status: PageLifecycleStatus }>> {
  try {
    const client = await createPageClient();
    const response = await client.publishPage({ id });
    revalidatePath('/admin/pages');
    return actionSuccess({ success: true, status: pageLifecycleStatus(response.status) });
  } catch (err) {
    return pageActionFailure(err, 'Failed to publish page', 'PAGE_PUBLISH_FAILED');
  }
}

export async function unpublishPageAction(
  id: string,
): Promise<ActionResult<{ success: true; status: PageLifecycleStatus }>> {
  try {
    const client = await createPageClient();
    const response = await client.unpublishPage({ id });
    revalidatePath('/admin/pages');
    return actionSuccess({ success: true, status: pageLifecycleStatus(response.status) });
  } catch (err) {
    return pageActionFailure(err, 'Failed to unpublish page', 'PAGE_UNPUBLISH_FAILED');
  }
}

export async function updatePageShowTitleAction(
  id: string,
  showTitle: boolean,
): Promise<ActionResult<{ success: true; showTitle: boolean }>> {
  try {
    const client = await createPageClient();
    const response = await client.updatePage({ id, showTitle });
    return actionSuccess({ success: true, showTitle: response.showTitle });
  } catch (err) {
    return pageActionFailure(err, 'Failed to update page show title', 'PAGE_UPDATE_SHOW_TITLE_FAILED');
  }
}

export async function updatePageSlugAction(
  id: string,
  slug: string | null,
): Promise<
  ActionResult<
    { success: true; slug: string | null },
    { reason: PageSlugValidationReason | 'alreadyExists' | 'checkFailed' }
  >
> {
  try {
    const client = await createPageClient();
    const requestedSlug = toSlugInputValue(slug);
    const response = await client.updatePage({ id, slug: requestedSlug });
    revalidatePath('/admin/pages');
    const canonicalSlug = response.slug ?? requestedSlug;
    return actionSuccess({ success: true, slug: canonicalSlug || null });
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
      return actionFailure(err.message, connectActionErrorCode(err, 'PAGE_UPDATE_SLUG_FAILED'), { reason });
    }
    return actionFailure(
      err instanceof Error ? err.message : 'Failed to update page slug',
      connectActionErrorCode(err, 'PAGE_UPDATE_SLUG_FAILED'),
      { reason: 'checkFailed' },
    );
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
}): Promise<ActionResult<{ shareLink: ShareLinkItem }>> {
  return createShareLinkAction(ShareLinkEntityType.PAGE, data.pageId, {
    label: data.label,
    expiresAt: data.expiresAt,
    password: data.password,
  });
}

export async function deletePageShareLinkAction(id: string): Promise<ActionResult<{ success: true }>> {
  return deleteShareLinkAction(id);
}

export async function regeneratePageOgImageAction(
  pageId: string,
  locale: string,
): Promise<ActionResult<{ success: true; runId?: string; generationId?: string }>> {
  const scopedLocale = normalizeOgRegenerationLocale(locale);
  if (!scopedLocale) {
    return actionFailure('Locale is required to regenerate this OG image', 'ACTION_INVALID_LOCALE');
  }

  const result = await requestOgImageRegeneration({
    entityType: 'page',
    entityId: pageId,
    selection: { type: 'locale', locale: scopedLocale },
  });
  if (!result.ok) {
    return actionFailure(result.error, result.errorCode);
  }
  return actionSuccess({ success: true, runId: result.runId, generationId: result.generationIds?.[0] });
}

export async function setPageFeaturedImageAction(
  pageId: string,
  fileId: string,
): Promise<ActionResult<{ imageUrl?: string; ogGenerationRunId?: string }>> {
  try {
    const client = await createPageClient();
    const result = await client.setPageFeaturedImage({ pageId, fileId });
    const imageUrl = resolveFeaturedImageDeliveryUrl(result.imageDelivery);
    const response = imageUrl ? { imageUrl } : {};
    return actionSuccess(
      result.ogGenerationRunId ? { ...response, ogGenerationRunId: result.ogGenerationRunId } : response,
    );
  } catch (err) {
    return pageActionFailure(err, 'Failed to set featured image', 'PAGE_SET_FEATURED_IMAGE_FAILED');
  }
}

export async function removePageFeaturedImageAction(
  pageId: string,
): Promise<ActionResult<{ success: true; ogGenerationRunId?: string }>> {
  try {
    const client = await createPageClient();
    const result = await client.deletePageFeaturedImage({ pageId });
    return actionSuccess(
      result.ogGenerationRunId ? { success: true, ogGenerationRunId: result.ogGenerationRunId } : { success: true },
    );
  } catch (err) {
    return pageActionFailure(err, 'Failed to remove featured image', 'PAGE_REMOVE_FEATURED_IMAGE_FAILED');
  }
}
