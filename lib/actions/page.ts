'use server';

import { logServerFailure } from '@/lib/logging/logger';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { connectActionErrorCode, isConnectError } from '@/lib/api/connect-error';
import { actionFailure, actionSuccess, type ActionResult } from '@/lib/actions/action-result';
import { runAction } from '@/lib/actions/run-action';
import { revalidatePath } from 'next/cache';
import { Code } from '@connectrpc/connect';
import { ShareLinkEntityType, type ShareLinkItem } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import { PageStatus } from '@echovisionlab/geul-proto/secure/page_pb.ts';
import { createShareLinkAction, deleteShareLinkAction, listShareLinksAction } from '@/lib/actions/share-link';
import { regenerateOgImageAction as requestOgImageRegeneration } from '@/lib/actions/og-generation';
import { createCommittedMutationRevalidator } from '@/lib/actions/revalidate-after-commit';
import { createMemberClient, createPageClient } from '@/lib/api/server-client';
import { resolveFeaturedImageDeliveryUrl } from '@/lib/media/post-featured-image';
import { normalizeOgRegenerationLocale } from '@/lib/utils/og-regeneration';
import { getPageSlugValidationReason, type PageSlugValidationReason } from '@/lib/utils/page-route';
import { toSlugInputValue } from '@/lib/utils/slug';
import {
  fromProtoPageAccessPolicy,
  toProtoPageAccessPolicy,
  type PageAccessPolicyValue,
} from '@/lib/types/page-access';

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

export async function createPageAction(): Promise<ActionResult<{ data: { id: string; slug: string | null } }>> {
  return runAction(
    'page-actions',
    'createPageAction',
    async () => {
      const client = await createPageClient();
      const page = await client.createPage({
        title: 'Untitled Page',
      });
      revalidatePath('/admin/pages');
      return { data: { id: page.id, slug: page.slug ?? null } };
    },
    { fallback: 'Failed to create page', code: 'PAGE_CREATE_FAILED' },
  );
}

export async function deletePageAdminAction(id: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'page-actions',
    'deletePageAdminAction',
    async () => {
      const client = await createPageClient();
      await client.deletePage({ id });
      revalidatePageAfterCommit('/admin/pages');
      return { success: true as const };
    },
    { fallback: 'Failed to delete page', code: 'PAGE_DELETE_FAILED' },
  );
}

// === Editor Mutations ===

export async function getPageNeutralConfigurationAction(id: string): Promise<
  ActionResult<{
    slug: string | null;
    showTitle: boolean;
    status: PageLifecycleStatus;
    accessPolicy: PageAccessPolicyValue;
  }>
> {
  return runAction(
    'page-actions',
    'getPageNeutralConfigurationAction',
    async () => {
      const client = await createPageClient();
      const page = await client.getPage({ id });
      return {
        slug: page.slug || null,
        showTitle: page.showTitle,
        status: pageLifecycleStatus(page.status),
        accessPolicy: fromProtoPageAccessPolicy(page.accessPolicy),
      };
    },
    { fallback: 'Failed to load page editor configuration', code: Code.Internal },
  );
}

export async function updatePageAccessPolicyAction(
  id: string,
  accessPolicy: PageAccessPolicyValue,
  editorOrigin?: string,
): Promise<ActionResult<{ accessPolicy: PageAccessPolicyValue }>> {
  return runAction(
    'page-actions',
    'updatePageAccessPolicyAction',
    async () => {
      const client = await createPageClient(editorOrigin);
      const page = await client.updatePage({ id, accessPolicy: toProtoPageAccessPolicy(accessPolicy) });
      const canonical = fromProtoPageAccessPolicy(page.accessPolicy);
      revalidatePageAfterCommit('/admin/pages');
      revalidatePageAfterCommit('/');
      revalidatePageAfterCommit(`/${page.slug || id}`);
      return { accessPolicy: canonical };
    },
    { fallback: 'Failed to update page access settings', code: Code.Internal },
  );
}

export async function getPageAccessTagOptionsAction(): Promise<
  ActionResult<{ tagOptions: { value: string; label: string }[] }>
> {
  return runAction(
    'page-actions',
    'getPageAccessTagOptionsAction',
    async () => {
      const client = await createMemberClient();
      const tagOptions: { value: string; label: string }[] = [];
      let offset = 0;
      let hasMore = false;
      do {
        const response = await client.listMemberTagsAdmin({ pagination: { limit: 500, offset } });
        tagOptions.push(...response.tags.map((tag) => ({ value: tag.id, label: tag.name })));
        offset += response.tags.length;
        hasMore = response.pagination?.hasMore ?? false;
      } while (hasMore);
      return { tagOptions };
    },
    { fallback: 'Failed to load member tags', code: Code.Internal },
  );
}

export async function publishPageAction(
  id: string,
  editorOrigin?: string,
): Promise<ActionResult<{ success: true; status: PageLifecycleStatus }>> {
  return runAction(
    'page-actions',
    'publishPageAction',
    async () => {
      const client = await createPageClient(editorOrigin);
      const response = await client.publishPage({ id });
      revalidatePath('/admin/pages');
      return { success: true as const, status: pageLifecycleStatus(response.status) };
    },
    { fallback: 'Failed to publish page', code: 'PAGE_PUBLISH_FAILED' },
  );
}

export async function unpublishPageAction(
  id: string,
  editorOrigin?: string,
): Promise<ActionResult<{ success: true; status: PageLifecycleStatus }>> {
  return runAction(
    'page-actions',
    'unpublishPageAction',
    async () => {
      const client = await createPageClient(editorOrigin);
      const response = await client.unpublishPage({ id });
      revalidatePath('/admin/pages');
      return { success: true as const, status: pageLifecycleStatus(response.status) };
    },
    { fallback: 'Failed to unpublish page', code: 'PAGE_UNPUBLISH_FAILED' },
  );
}

export async function updatePageShowTitleAction(
  id: string,
  showTitle: boolean,
  editorOrigin?: string,
): Promise<ActionResult<{ success: true; showTitle: boolean }>> {
  return runAction(
    'page-actions',
    'updatePageShowTitleAction',
    async () => {
      const client = await createPageClient(editorOrigin);
      const response = await client.updatePage({ id, showTitle });
      return { success: true as const, showTitle: response.showTitle };
    },
    { fallback: 'Failed to update page show title', code: 'PAGE_UPDATE_SHOW_TITLE_FAILED' },
  );
}

export async function updatePageSlugAction(
  id: string,
  slug: string | null,
  editorOrigin?: string,
): Promise<
  ActionResult<
    { success: true; slug: string | null },
    { reason: PageSlugValidationReason | 'alreadyExists' | 'checkFailed' }
  >
> {
  try {
    const client = await createPageClient(editorOrigin);
    const requestedSlug = toSlugInputValue(slug);
    const response = await client.updatePage({ id, slug: requestedSlug });
    revalidatePath('/admin/pages');
    const canonicalSlug = response.slug ?? requestedSlug;
    return actionSuccess({ success: true, slug: canonicalSlug || null });
  } catch (err) {
    logServerFailure('page-actions', 'updatePageSlugAction', err);
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
  return listShareLinksAction(ShareLinkEntityType.PAGE, pageId).then(unwrapQueryResult);
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
  return runAction(
    'page-actions',
    'setPageFeaturedImageAction',
    async () => {
      const client = await createPageClient();
      const result = await client.setPageFeaturedImage({ pageId, fileId });
      const imageUrl = resolveFeaturedImageDeliveryUrl(result.imageDelivery);
      const response = imageUrl ? { imageUrl } : {};
      return result.ogGenerationRunId ? { ...response, ogGenerationRunId: result.ogGenerationRunId } : response;
    },
    { fallback: 'Failed to set featured image', code: 'PAGE_SET_FEATURED_IMAGE_FAILED' },
  );
}

export async function removePageFeaturedImageAction(
  pageId: string,
): Promise<ActionResult<{ success: true; ogGenerationRunId?: string }>> {
  return runAction(
    'page-actions',
    'removePageFeaturedImageAction',
    async () => {
      const client = await createPageClient();
      const result = await client.deletePageFeaturedImage({ pageId });
      return result.ogGenerationRunId
        ? { success: true as const, ogGenerationRunId: result.ogGenerationRunId }
        : { success: true as const };
    },
    { fallback: 'Failed to remove featured image', code: 'PAGE_REMOVE_FEATURED_IMAGE_FAILED' },
  );
}
