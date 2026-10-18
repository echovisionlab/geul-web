import { unwrapQueryResult } from '@/lib/api/query-result';
import { Code, ConnectError } from '@connectrpc/connect';
import { ShareLinkEntityType } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assetRefFixture } from '@/tests/helpers/asset-ref';
import * as series from './series';
import * as shareLink from './share-link';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createSeriesClient: vi.fn(),
  createShareLinkClient: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  revalidatePath: vi.fn(),
}));

const seriesClient = vi.hoisted(() => ({
  addSeriesManager: vi.fn(),
  assignPostToSeries: vi.fn(),
  createSeries: vi.fn(),
  deleteSeries: vi.fn(),
  deleteSeriesFeaturedImage: vi.fn(),
  removeSeriesManager: vi.fn(),
  reorderSeriesPosts: vi.fn(),
  setSeriesFeaturedImage: vi.fn(),
  unassignPostFromSeries: vi.fn(),
  updateSeries: vi.fn(),
}));

const adminClient = vi.hoisted(() => ({
  regenerateOgImage: vi.fn(),
}));

const shareLinkClient = vi.hoisted(() => ({
  createShareLink: vi.fn(),
  deleteShareLink: vi.fn(),
  listShareLinks: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/lib/api/server-client', () => ({
  createAdminClient: mocks.createAdminClient,
  createSeriesClient: mocks.createSeriesClient,
  createShareLinkClient: mocks.createShareLinkClient,
}));

vi.mock('@/lib/env', () => ({
  env: { HOST: 'studio.example.com' },
}));

vi.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({ error: mocks.loggerError, warn: mocks.loggerWarn }),
}));

describe('series and share-link actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSeriesClient.mockResolvedValue(seriesClient);
    mocks.createAdminClient.mockResolvedValue(adminClient);
    mocks.createShareLinkClient.mockResolvedValue(shareLinkClient);
    seriesClient.createSeries.mockResolvedValue({ id: 'series-1' });
    seriesClient.setSeriesFeaturedImage.mockResolvedValue({
      imageAsset: assetRefFixture('https://cdn.example/series.webp'),
      ogGenerationRunId: 'featured-run',
    });
    seriesClient.deleteSeriesFeaturedImage.mockResolvedValue({
      success: true,
      ogGenerationRunId: 'delete-featured-run',
    });
    adminClient.regenerateOgImage.mockResolvedValue({
      runId: 'run-1',
      generationIds: ['generation-1'],
    });
    shareLinkClient.listShareLinks.mockResolvedValue({
      shareLinks: [
        { id: 'share-1', url: '/share/one' },
        { id: 'share-2', url: '//cdn.example/share/two' },
        { id: 'share-3', url: 'https://external.example/share/three' },
      ],
    });
    shareLinkClient.createShareLink.mockResolvedValue({
      shareLink: { id: 'share-1', url: 'share/one' },
    });
    shareLinkClient.deleteShareLink.mockResolvedValue({ success: true });
  });

  it('maps post and target Series authority failures without exposing server messages', async () => {
    seriesClient.assignPostToSeries.mockRejectedValueOnce(
      new ConnectError('raw post permission detail', Code.PermissionDenied),
    );
    seriesClient.unassignPostFromSeries.mockRejectedValueOnce(
      new ConnectError('raw series lookup detail', Code.NotFound),
    );
    seriesClient.reorderSeriesPosts.mockRejectedValueOnce(new ConnectError('raw internal detail', Code.Internal));

    await expect(series.assignPostToSeriesAction('series-1', 'post-1')).resolves.toEqual({
      error: 'post_permission_revoked',
    });
    await expect(series.unassignPostFromSeriesAction('series-1', 'post-1')).resolves.toEqual({
      error: 'series_unavailable',
    });
    await expect(series.reorderSeriesPostsAction('series-1', ['post-1'])).resolves.toEqual({
      error: 'failed',
    });
  });

  it('does not report a committed Series delete as failed when revalidation throws', async () => {
    mocks.revalidatePath
      .mockImplementationOnce(() => {
        throw new Error('cache unavailable');
      })
      .mockImplementationOnce(() => {
        throw new Error('cache unavailable');
      });

    await expect(series.deleteSeriesAction('series-1')).resolves.toEqual({ success: true });
    expect(seriesClient.deleteSeries).toHaveBeenCalledWith({ id: 'series-1' });
    expect(mocks.loggerWarn).toHaveBeenCalledTimes(2);
  });

  it('normalizes share-link URLs and maps handled errors', async () => {
    await expect(
      shareLink.listShareLinksAction(ShareLinkEntityType.POST, 'post-1').then(unwrapQueryResult),
    ).resolves.toEqual([
      { id: 'share-1', url: 'https://studio.example.com/share/one' },
      { id: 'share-2', url: 'https://cdn.example/share/two' },
      { id: 'share-3', url: 'https://external.example/share/three' },
    ]);
    await expect(
      shareLink.createShareLinkAction(ShareLinkEntityType.POST, 'post-1', {
        label: 'Preview',
        expiresAt: new Date('2026-01-01T00:00:00Z'),
        password: 'preview-secret',
      }),
    ).resolves.toEqual({
      ok: true,
      shareLink: { id: 'share-1', url: 'https://studio.example.com/share/one' },
    });
    await expect(shareLink.deleteShareLinkAction('share-1')).resolves.toEqual({ ok: true, success: true });

    shareLinkClient.createShareLink.mockRejectedValueOnce(new ConnectError('missing', Code.NotFound));
    await expect(shareLink.createShareLinkAction(ShareLinkEntityType.POST, 'missing')).resolves.toEqual({
      ok: false,
      error: 'Entity not found',
      errorCode: Code.NotFound,
    });
  });
});
