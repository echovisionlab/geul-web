import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { WorkType as PublicWorkType } from '@echovisionlab/geul-proto/public/work_pb.ts';
import { OgEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { MyCreditedWorkCreditType, WorkStatus, WorkType } from '@echovisionlab/geul-proto/secure/work_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assetRefFixture } from '@/tests/helpers/asset-ref';
import * as actions from './work';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createArtistClient: vi.fn(),
  createPublicWorkClient: vi.fn(),
  createShareLinkAction: vi.fn(),
  createWorkClient: vi.fn(),
  deleteShareLinkAction: vi.fn(),
  listShareLinksAction: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  regenerateOgImage: vi.fn(),
  revalidatePath: vi.fn(),
}));

const workClient = vi.hoisted(() => ({
  addWorkCredit: vi.fn(),
  createWork: vi.fn(),
  createWorkCreditGroup: vi.fn(),
  deleteWork: vi.fn(),
  deleteWorkCredit: vi.fn(),
  deleteWorkCreditGroup: vi.fn(),
  deleteWorkFeaturedImage: vi.fn(),
  getWorkCredits: vi.fn(),
  listMyCreditedWorks: vi.fn(),
  listWorksAdmin: vi.fn(),
  publishWork: vi.fn(),
  setWorkFeaturedImage: vi.fn(),
  unpublishWork: vi.fn(),
  updateWork: vi.fn(),
  updateWorkCredit: vi.fn(),
  updateWorkCreditGroup: vi.fn(),
}));

const publicWorkClient = vi.hoisted(() => ({
  list: vi.fn(),
}));

const artistClient = vi.hoisted(() => ({
  listArtists: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/lib/api/server-client', () => ({
  createAdminClient: mocks.createAdminClient,
  createArtistClient: mocks.createArtistClient,
  createPublicWorkClient: mocks.createPublicWorkClient,
  createWorkClient: mocks.createWorkClient,
}));

vi.mock('@/lib/actions/share-link', () => ({
  createShareLinkAction: mocks.createShareLinkAction,
  deleteShareLinkAction: mocks.deleteShareLinkAction,
  listShareLinksAction: mocks.listShareLinksAction,
}));

vi.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({ error: mocks.loggerError, warn: mocks.loggerWarn }),
}));

describe('work actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createWorkClient.mockResolvedValue(workClient);
    mocks.createPublicWorkClient.mockReturnValue(publicWorkClient);
    mocks.createArtistClient.mockResolvedValue(artistClient);
    mocks.regenerateOgImage.mockResolvedValue({ runId: 'run-1', generationIds: ['generation-1'] });
    mocks.createAdminClient.mockResolvedValue({ regenerateOgImage: mocks.regenerateOgImage });
    mocks.createShareLinkAction.mockResolvedValue({ shareLink: { id: 'share-1' } });
    mocks.deleteShareLinkAction.mockResolvedValue({ success: true });
    mocks.listShareLinksAction.mockResolvedValue([{ id: 'share-1' }]);

    publicWorkClient.list.mockResolvedValue({
      works: [
        {
          id: 'public-work-1',
          title: 'Public Work',
          slug: undefined,
          type: PublicWorkType.ARTICLE,
          summary: undefined,
          featuredImageUrl: undefined,
          featured: true,
          mapPlaceId: undefined,
          publishedAt: timestampFromDate(new Date('2026-01-01T00:00:00Z')),
        },
      ],
      pagination: { total: 1 },
    });
    workClient.listWorksAdmin.mockResolvedValue({
      works: [
        {
          work: {
            id: 'work-1',
            title: 'Work',
            slug: 'work',
            type: WorkType.PORTFOLIO,
            featuredImageUrl: undefined,
            featured: false,
            status: WorkStatus.PUBLISHED,
            createdAt: timestampFromDate(new Date('2026-01-01T00:00:00Z')),
            updatedAt: undefined,
          },
          creditCount: 2,
          clientCount: 1,
        },
      ],
      pagination: { total: 1 },
    });
    workClient.createWork.mockResolvedValue({ id: 'work-1' });
    workClient.setWorkFeaturedImage.mockResolvedValue({
      imageAsset: assetRefFixture('https://cdn.example/work.webp'),
      ogGenerationRunId: 'featured-run',
    });
    workClient.deleteWorkFeaturedImage.mockResolvedValue({
      success: true,
      ogGenerationRunId: 'delete-featured-run',
    });
    workClient.getWorkCredits.mockResolvedValue({
      groups: [{ id: 'group-1', workId: 'work-1', name: 'Music', sortOrder: 0 }],
      credits: [
        {
          id: 'credit-1',
          groupId: undefined,
          name: 'Guest',
          creditRole: undefined,
          sortOrder: 1,
          artist: { id: 'artist-1', name: 'Artist', slug: undefined, imageUrl: undefined },
          member: undefined,
        },
      ],
    });
    workClient.addWorkCredit.mockResolvedValue({ id: 'credit-1' });
    workClient.createWorkCreditGroup.mockResolvedValue({ id: 'group-1', name: 'Band' });
    workClient.listMyCreditedWorks.mockResolvedValue({
      works: [
        {
          workId: 'work-1',
          title: 'Credited',
          slug: undefined,
          type: WorkType.MUSIC_PROJECT,
          status: WorkStatus.ARCHIVED,
          creditId: 'credit-1',
          creditRole: undefined,
          creditType: MyCreditedWorkCreditType.ARTIST,
          creditedAs: 'Artist',
          creditedAsImage: undefined,
        },
      ],
      pagination: { total: 1 },
    });
    artistClient.listArtists.mockResolvedValue({
      artists: [{ id: 'artist-1', name: 'Artist', imageUrl: undefined }],
    });
  });

  it('preserves a committed Work update when cache revalidation fails', async () => {
    workClient.updateWork.mockResolvedValue({ success: true });
    mocks.revalidatePath.mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });

    await expect(actions.updateWorkAction('work-1', { mapPlaceId: 'place-1' })).resolves.toEqual({
      success: true,
    });
    expect(mocks.loggerWarn).toHaveBeenCalledTimes(1);
  });

  it('does not report a committed Work delete as failed when cache revalidation throws', async () => {
    mocks.revalidatePath.mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });

    await expect(actions.deleteWorkAction('work-1')).resolves.toEqual({ success: true });
    expect(workClient.deleteWork).toHaveBeenCalledWith({ id: 'work-1' });
    expect(mocks.loggerWarn).toHaveBeenCalledTimes(1);
  });

  it('maps public, admin, and credited work list responses', async () => {
    await expect(
      actions.listWorksPublishedAction({
        types: ['article'],
        featured: true,
        limit: 4,
        offset: 8,
        sortBy: 'published_at',
        sortOrder: 'asc',
      }),
    ).resolves.toMatchObject({
      works: [{ id: 'public-work-1', type: 'article', featured: true }],
      pagination: { total: 1, limit: 4, offset: 8 },
    });
    await expect(
      actions.listWorksAdminAction({
        page: 2,
        pageSize: 5,
        search: 'work',
        type: 'portfolio',
        status: 'published',
        sort: [{ field: 'title', order: 'desc' }],
      }),
    ).resolves.toMatchObject({
      data: [{ id: 'work-1', type: 'portfolio', status: 'published' }],
      page: 2,
      pageSize: 5,
    });
    await expect(
      actions.listMyCreditedWorksAction({
        search: ' credited ',
        type: 'music_project',
        status: 'published',
        filter: [
          { field: 'title', op: 'ilike', value: 'Credited' },
          { field: 'type', op: 'in', value: ['music_project', 123] },
          { field: 'status', op: 'isNull', value: false },
        ],
      }),
    ).resolves.toMatchObject({
      data: [{ id: 'work-1', status: 'archived', creditType: 'artist' }],
      total: 1,
    });
  });

  it('maps work mutations, credits, share links, and OG refreshes', async () => {
    await expect(
      actions.createWorkAction({
        title: 'Work',
        type: 'music_project',
        year: 2026,
        month: 1,
        untilYear: null,
        untilMonth: null,
        isPresent: true,
        summary: 'Summary',
        metadata: { role: 'sound' },
        featured: true,
      }),
    ).resolves.toEqual({ data: { id: 'work-1' } });
    await expect(actions.updateWorkAction('work-1', { mapPlaceId: null })).resolves.toEqual({
      success: true,
    });
    await expect(actions.updateWorkSlugAction('work-1', ' New Slug ')).resolves.toEqual({
      success: true,
      slug: ' New Slug ',
    });
    await expect(actions.publishWorkAction('work-1')).resolves.toEqual({ success: true });
    await expect(actions.unpublishWorkAction('work-1')).resolves.toEqual({ success: true });
    await expect(actions.deleteWorkAction('work-1')).resolves.toEqual({ success: true });
    await expect(actions.setWorkFeaturedImageAction('work-1', 'file-1')).resolves.toEqual({
      success: true,
      imageUrl: 'https://cdn.example/work.webp',
      ogGenerationRunId: 'featured-run',
    });
    await expect(actions.removeWorkFeaturedImageAction('work-1')).resolves.toEqual({
      success: true,
      ogGenerationRunId: 'delete-featured-run',
    });
    await expect(actions.getWorkGroupsWithCreditsAction('work-1')).resolves.toMatchObject({
      groups: [{ id: 'group-1' }],
      credits: [{ id: 'credit-1', artist: { id: 'artist-1' } }],
    });
    await expect(actions.addWorkCreditAction({ workId: 'work-1', name: 'Guest' })).resolves.toEqual({
      success: true,
      creditId: 'credit-1',
    });
    await expect(actions.updateWorkCreditAction('credit-1', { groupId: null })).resolves.toEqual({
      success: true,
    });
    await expect(actions.removeWorkCreditAction('credit-1')).resolves.toEqual({ success: true });
    await expect(actions.regenerateWorkOgImageAction('work-1', 'ko')).resolves.toEqual({
      success: true,
      runId: 'run-1',
      generationId: 'generation-1',
    });
    await expect(actions.createWorkCreditGroupAction({ workId: 'work-1', name: 'Band' })).resolves.toEqual({
      success: true,
      group: { id: 'group-1', name: 'Band' },
    });
    await expect(actions.updateWorkCreditGroupAction('group-1', { name: 'Crew' })).resolves.toEqual({
      success: true,
    });
    await expect(actions.deleteWorkCreditGroupAction('group-1')).resolves.toEqual({
      success: true,
    });
    await expect(actions.searchArtistsForCreditAction('work-1', ' Artist ')).resolves.toEqual([
      { id: 'artist-1', name: 'Artist', imageUrl: null },
    ]);
    await expect(actions.searchArtistsForCreditAction('work-1', '   ')).resolves.toEqual([]);
    await expect(actions.listWorkShareLinksAction('work-1')).resolves.toEqual([{ id: 'share-1' }]);
    await expect(actions.createWorkShareLinkAction({ workId: 'work-1', label: 'Preview' })).resolves.toEqual({
      shareLink: { id: 'share-1' },
    });
    await expect(actions.deleteWorkShareLinkAction('share-1')).resolves.toEqual({ success: true });

    expect(workClient.createWork).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Work', type: WorkType.MUSIC_PROJECT, isPresent: true }),
    );
    expect(workClient.updateWork).toHaveBeenCalledWith({
      id: 'work-1',
      mapPlaceId: '',
    });
    expect(mocks.regenerateOgImage).toHaveBeenCalledWith({
      entityType: OgEntityType.WORK,
      entityId: 'work-1',
      selection: { target: { case: 'locale', value: 'ko' } },
    });
  });

  it('returns stable empty results and action errors on backend failures', async () => {
    publicWorkClient.list.mockRejectedValueOnce(new Error('offline'));
    await expect(actions.listWorksPublishedAction({ limit: 2, offset: 3 })).resolves.toEqual({
      works: [],
      pagination: { total: 0, limit: 2, offset: 3 },
    });

    workClient.publishWork.mockRejectedValueOnce(new ConnectError('missing', Code.NotFound));
    await expect(actions.publishWorkAction('missing')).resolves.toEqual({
      error: 'Work not found',
    });

    workClient.setWorkFeaturedImage.mockRejectedValueOnce(new ConnectError('denied', Code.PermissionDenied));
    await expect(actions.setWorkFeaturedImageAction('work-1', 'file-1')).resolves.toEqual({
      error: 'No permission to edit this work',
    });
  });
});
