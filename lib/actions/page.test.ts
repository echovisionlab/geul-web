import { Code, ConnectError } from '@connectrpc/connect';
import { OgEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deletePageAdminAction,
  regeneratePageOgImageAction,
  setPageFeaturedImageAction,
  updatePageSlugAction,
} from './page';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createPageClient: vi.fn(),
  regenerateOgImage: vi.fn(),
  revalidatePath: vi.fn(),
}));

const pageClient = vi.hoisted(() => ({
  deletePage: vi.fn(),
  setPageFeaturedImage: vi.fn(),
  updatePage: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/lib/api/server-client', () => ({
  createAdminClient: mocks.createAdminClient,
  createPageClient: mocks.createPageClient,
}));

vi.mock('@/lib/actions/share-link', () => ({
  createShareLinkAction: vi.fn(),
  deleteShareLinkAction: vi.fn(),
  listShareLinksAction: vi.fn(),
}));

describe('page actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.regenerateOgImage.mockResolvedValue({ runId: 'run-1', generationIds: ['generation-1'] });
    mocks.createAdminClient.mockResolvedValue({ regenerateOgImage: mocks.regenerateOgImage });
    mocks.createPageClient.mockResolvedValue(pageClient);
  });

  it('regenerates the OG image for the active locale only', async () => {
    await expect(regeneratePageOgImageAction('page-1', ' ja ')).resolves.toEqual({
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
      error: 'Locale is required to regenerate this OG image',
    });

    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.regenerateOgImage).not.toHaveBeenCalled();
  });

  it('does not report a committed delete as failed when cache revalidation throws', async () => {
    mocks.revalidatePath.mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });

    await expect(deletePageAdminAction('page-1')).resolves.toEqual({ success: true });
    expect(pageClient.deletePage).toHaveBeenCalledWith({ id: 'page-1' });
  });

  it('uses signed MediaDelivery for the editor featured-image preview', async () => {
    pageClient.setPageFeaturedImage.mockResolvedValue({
      imageDelivery: {
        thumbnail: { url: 'https://signed.example/page-thumbnail.webp' },
      },
      ogGenerationRunId: 'og-run-1',
    });

    await expect(setPageFeaturedImageAction('page-1', 'file-1')).resolves.toEqual({
      imageUrl: 'https://signed.example/page-thumbnail.webp',
      ogGenerationRunId: 'og-run-1',
    });
    expect(pageClient.setPageFeaturedImage).toHaveBeenCalledWith({ pageId: 'page-1', fileId: 'file-1' });
  });

  it('returns a localized slug reason for an API race rejection', async () => {
    pageClient.updatePage.mockRejectedValueOnce(new ConnectError('duplicate', Code.AlreadyExists));

    await expect(updatePageSlugAction('page-1', 'some/where')).resolves.toMatchObject({
      reason: 'alreadyExists',
    });
  });

  it('keeps the Page path reason when the API rejects an invalid path', async () => {
    pageClient.updatePage.mockRejectedValueOnce(new ConnectError('invalid', Code.InvalidArgument));

    await expect(updatePageSlugAction('page-1', 'about//team')).resolves.toMatchObject({
      reason: 'emptySegment',
    });
  });
});
