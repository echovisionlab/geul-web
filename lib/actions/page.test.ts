import { toProtoPageAccessPolicy, DEFAULT_PAGE_ACCESS_POLICY } from '@/lib/types/page-access';
import { Code, ConnectError } from '@connectrpc/connect';
import { OgEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { PageStatus } from '@echovisionlab/geul-proto/secure/page_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deletePageAdminAction,
  getPageNeutralConfigurationAction,
  getPageAccessTagOptionsAction,
  updatePageAccessPolicyAction,
  publishPageAction,
  regeneratePageOgImageAction,
  setPageFeaturedImageAction,
  unpublishPageAction,
  updatePageShowTitleAction,
  updatePageSlugAction,
} from './page';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createPageClient: vi.fn(),
  createMemberClient: vi.fn(),
  listMemberTagsAdmin: vi.fn(),
  regenerateOgImage: vi.fn(),
  revalidatePath: vi.fn(),
}));

const pageClient = vi.hoisted(() => ({
  deletePage: vi.fn(),
  getPage: vi.fn(),
  publishPage: vi.fn(),
  setPageFeaturedImage: vi.fn(),
  unpublishPage: vi.fn(),
  updatePage: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/lib/api/server-client', () => ({
  createAdminClient: mocks.createAdminClient,
  createPageClient: mocks.createPageClient,
  createMemberClient: mocks.createMemberClient,
}));

vi.mock('@/lib/actions/share-link', () => ({
  createShareLinkAction: vi.fn(),
  deleteShareLinkAction: vi.fn(),
  listShareLinksAction: vi.fn(),
}));

describe('page actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.regenerateOgImage.mockResolvedValue({ ok: true, runId: 'run-1', generationIds: ['generation-1'] });
    mocks.createAdminClient.mockResolvedValue({ regenerateOgImage: mocks.regenerateOgImage });
    mocks.createPageClient.mockResolvedValue(pageClient);
    mocks.createMemberClient.mockResolvedValue({ listMemberTagsAdmin: mocks.listMemberTagsAdmin });
  });

  it('regenerates the OG image for the active locale only', async () => {
    await expect(regeneratePageOgImageAction('page-1', ' ja ')).resolves.toEqual({
      ok: true,
      success: true,
      runId: 'run-1',
      generationId: 'generation-1',
    });

    expect(mocks.regenerateOgImage).toHaveBeenCalledWith({
      entityType: OgEntityType.PAGE,
      entityId: 'page-1',
      selection: { target: { case: 'locale', value: 'ja' } },
    });
  });

  it('does not queue an unscoped OG regeneration', async () => {
    await expect(regeneratePageOgImageAction('page-1', '')).resolves.toEqual({
      ok: false,
      error: 'Locale is required to regenerate this OG image',
      errorCode: 'ACTION_INVALID_LOCALE',
    });

    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.regenerateOgImage).not.toHaveBeenCalled();
  });

  it('does not report a committed delete as failed when cache revalidation throws', async () => {
    mocks.revalidatePath.mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });

    await expect(deletePageAdminAction('page-1')).resolves.toEqual({ ok: true, success: true });
    expect(pageClient.deletePage).toHaveBeenCalledWith({ id: 'page-1' });
  });

  it('loads the canonical neutral editor configuration through the authorized Page client', async () => {
    pageClient.getPage.mockResolvedValueOnce({
      slug: 'canonical-path',
      showTitle: false,
      status: PageStatus.PUBLISHED,
    });

    await expect(getPageNeutralConfigurationAction('page-1')).resolves.toEqual({
      ok: true,
      slug: 'canonical-path',
      showTitle: false,
      status: 'published',
      accessPolicy: DEFAULT_PAGE_ACCESS_POLICY,
    });
    expect(pageClient.getPage).toHaveBeenCalledWith({ id: 'page-1' });
  });

  it('saves access through UpdatePage, returns the canonical projection, and survives revalidation failure', async () => {
    const requested = {
      ...DEFAULT_PAGE_ACCESS_POLICY,
      mode: 'conditions' as const,
      userTagIds: ['tag-1'],
      newsletterSubscriber: true,
    };
    const canonical = { ...requested, match: 'all' as const };
    pageClient.updatePage.mockResolvedValueOnce({ slug: 'members', accessPolicy: toProtoPageAccessPolicy(canonical) });
    mocks.revalidatePath.mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });
    await expect(updatePageAccessPolicyAction('page-1', requested)).resolves.toEqual({
      ok: true,
      accessPolicy: canonical,
    });
    expect(pageClient.updatePage).toHaveBeenCalledWith({
      id: 'page-1',
      accessPolicy: toProtoPageAccessPolicy(requested),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/members');
    pageClient.getPage.mockResolvedValueOnce({
      slug: 'members',
      showTitle: false,
      status: PageStatus.PUBLISHED,
      accessPolicy: toProtoPageAccessPolicy(canonical),
    });
    await expect(getPageNeutralConfigurationAction('page-1')).resolves.toMatchObject({
      ok: true,
      accessPolicy: canonical,
    });
    pageClient.updatePage.mockRejectedValueOnce(new ConnectError('permission revoked', Code.PermissionDenied));
    await expect(updatePageAccessPolicyAction('page-1', requested)).resolves.toMatchObject({
      ok: false,
      errorCode: Code.PermissionDenied,
    });
  });

  it('returns exact member tag ids across pages and reports load failures distinctly from empty data', async () => {
    mocks.listMemberTagsAdmin
      .mockResolvedValueOnce({ tags: [{ id: 'tag-1', name: 'Supporter' }], pagination: { hasMore: true } })
      .mockResolvedValueOnce({ tags: [{ id: 'tag-2', name: 'Workshop' }], pagination: { hasMore: false } });
    await expect(getPageAccessTagOptionsAction()).resolves.toEqual({
      ok: true,
      tagOptions: [
        { value: 'tag-1', label: 'Supporter' },
        { value: 'tag-2', label: 'Workshop' },
      ],
    });
    expect(mocks.listMemberTagsAdmin).toHaveBeenNthCalledWith(2, { pagination: { limit: 500, offset: 1 } });
    mocks.listMemberTagsAdmin.mockRejectedValueOnce(new ConnectError('denied', Code.PermissionDenied));
    await expect(getPageAccessTagOptionsAction()).resolves.toMatchObject({
      ok: false,
      errorCode: Code.PermissionDenied,
    });
    mocks.listMemberTagsAdmin.mockResolvedValueOnce({ tags: [], pagination: { hasMore: false } });
    await expect(getPageAccessTagOptionsAction()).resolves.toEqual({ ok: true, tagOptions: [] });
  });

  it('returns a typed failure when the Page client returns an unsupported lifecycle status', async () => {
    pageClient.getPage.mockResolvedValueOnce({ slug: '', showTitle: true, status: PageStatus.UNSPECIFIED });

    await expect(getPageNeutralConfigurationAction('page-1')).resolves.toMatchObject({
      ok: false,
      errorCode: Code.Internal,
    });
  });

  it('uses signed MediaDelivery for the editor featured-image preview', async () => {
    pageClient.setPageFeaturedImage.mockResolvedValue({
      imageDelivery: {
        thumbnail: { url: 'https://signed.example/page-thumbnail.webp' },
      },
      ogGenerationRunId: 'og-run-1',
    });

    await expect(setPageFeaturedImageAction('page-1', 'file-1')).resolves.toEqual({
      ok: true,
      imageUrl: 'https://signed.example/page-thumbnail.webp',
      ogGenerationRunId: 'og-run-1',
    });
    expect(pageClient.setPageFeaturedImage).toHaveBeenCalledWith({ pageId: 'page-1', fileId: 'file-1' });
  });

  it('returns a localized slug reason for an API race rejection', async () => {
    pageClient.updatePage.mockRejectedValueOnce(new ConnectError('duplicate', Code.AlreadyExists));

    await expect(updatePageSlugAction('page-1', 'some/where')).resolves.toMatchObject({
      ok: false,
      errorCode: Code.AlreadyExists,
      reason: 'alreadyExists',
    });
  });

  it('keeps the Page path reason when the API rejects an invalid path', async () => {
    pageClient.updatePage.mockRejectedValueOnce(new ConnectError('invalid', Code.InvalidArgument));

    await expect(updatePageSlugAction('page-1', 'about//team')).resolves.toMatchObject({
      ok: false,
      errorCode: Code.InvalidArgument,
      reason: 'emptySegment',
    });
  });

  it('returns the server-canonical slug after a successful update', async () => {
    pageClient.updatePage.mockResolvedValueOnce({ slug: 'canonical-path' });

    await expect(updatePageSlugAction('page-1', 'requested-path')).resolves.toMatchObject({
      ok: true,
      slug: 'canonical-path',
    });
  });

  it('returns the canonical show-title value after a successful update', async () => {
    pageClient.updatePage.mockResolvedValueOnce({ showTitle: false });

    await expect(updatePageShowTitleAction('page-1', true)).resolves.toEqual({
      ok: true,
      success: true,
      showTitle: false,
    });
  });

  it('returns canonical lifecycle statuses after publish and unpublish', async () => {
    pageClient.publishPage.mockResolvedValueOnce({ status: PageStatus.PUBLISHED });
    pageClient.unpublishPage.mockResolvedValueOnce({ status: PageStatus.DRAFT });

    await expect(publishPageAction('page-1')).resolves.toEqual({ ok: true, success: true, status: 'published' });
    await expect(unpublishPageAction('page-1')).resolves.toEqual({ ok: true, success: true, status: 'draft' });
  });
});
