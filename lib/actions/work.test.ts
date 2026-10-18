import { unwrapQueryResult } from '@/lib/api/query-result';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { WorkType as PublicWorkType } from '@echovisionlab/geul-proto/public/work_pb.ts';
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
  getWork: vi.fn(),
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
    mocks.listShareLinksAction.mockResolvedValue({ ok: true, value: [{ id: 'share-1' }] });

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

  it('reloads neutral settings through the authorized Work selector without room content', async () => {
    workClient.getWork.mockResolvedValueOnce({
      id: 'work-1',
      title: 'Room title',
      summary: 'Room summary',
      document: { private: true },
      slug: 'work-slug',
      type: WorkType.PORTFOLIO,
      year: 2026,
      month: 4,
      untilYear: undefined,
      untilMonth: undefined,
      isPresent: true,
      metadata: { peer: 'value' },
      featured: true,
      clients: [{ id: 'client-b' }, { id: 'client-a' }],
      mapPlaceId: 'place-1',
      featuredImageAsset: assetRefFixture('https://cdn.example/featured.webp'),
    });
    await expect(actions.getWorkConfigurationAction('work-1')).resolves.toEqual({
      data: {
        slug: 'work-slug',
        type: 'portfolio',
        year: 2026,
        month: 4,
        untilYear: null,
        untilMonth: null,
        isPresent: true,
        metadata: { peer: 'value' },
        featured: true,
        clients: ['client-b', 'client-a'],
        mapPlaceId: 'place-1',
        featuredImageUrl: 'https://cdn.example/featured.webp',
      },
    });
    expect(workClient.getWork).toHaveBeenCalledWith({ id: 'work-1' });
    expect(mocks.createPublicWorkClient).not.toHaveBeenCalled();
  });

  it('preserves authorized configuration read failures', async () => {
    workClient.getWork.mockRejectedValueOnce(new ConnectError('Not allowed', Code.PermissionDenied));
    const result = await actions.getWorkConfigurationAction('work-1');
    expect(result).toEqual({ error: expect.stringContaining('Not allowed') });
    expect(result).not.toHaveProperty('data');
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
      actions
        .listWorksPublishedAction({
          types: ['article'],
          featured: true,
          limit: 4,
          offset: 8,
          sortBy: 'published_at',
          sortOrder: 'asc',
        })
        .then(unwrapQueryResult),
    ).resolves.toMatchObject({
      works: [{ id: 'public-work-1', type: 'article', featured: true }],
      pagination: { total: 1, limit: 4, offset: 8 },
    });
    await expect(
      actions
        .listWorksAdminAction({
          page: 2,
          pageSize: 5,
          search: 'work',
          type: 'portfolio',
          status: 'published',
          sort: [{ field: 'title', order: 'desc' }],
        })
        .then(unwrapQueryResult),
    ).resolves.toMatchObject({
      data: [{ id: 'work-1', type: 'portfolio', status: 'published' }],
      page: 2,
      pageSize: 5,
    });
    await expect(
      actions
        .listMyCreditedWorksAction({
          search: ' credited ',
          type: 'music_project',
          status: 'published',
          filter: [
            { field: 'title', op: 'ilike', value: 'Credited' },
            { field: 'type', op: 'in', value: ['music_project', 123] },
            { field: 'status', op: 'isNull', value: false },
          ],
        })
        .then(unwrapQueryResult),
    ).resolves.toMatchObject({
      data: [{ id: 'work-1', status: 'archived', creditType: 'artist' }],
      total: 1,
    });
  });

  it('sends metadata and client baselines with mergeable Work field changes', async () => {
    workClient.updateWork.mockResolvedValue({});

    await expect(
      actions.updateWorkFieldsAction('work-1', {
        metadata: { nested: { label: '' }, tags: [] },
        observedMetadata: { nested: { label: 'old' }, tags: ['old'] },
        clients: ['client-b'],
        observedClients: ['client-a'],
      }),
    ).resolves.toEqual({ success: true });

    expect(workClient.updateWork).toHaveBeenCalledWith({
      id: 'work-1',
      type: undefined,
      metadata: { nested: { label: '' }, tags: [] },
      observedMetadata: { nested: { label: 'old' }, tags: ['old'] },
      featured: undefined,
      clients: { $typeName: 'api.manage.v1.WorkClientsUpdate', clientIds: ['client-b'] },
      observedClients: { $typeName: 'api.manage.v1.WorkClientsUpdate', clientIds: ['client-a'] },
      year: undefined,
      month: undefined,
      untilYear: undefined,
      untilMonth: undefined,
      isPresent: undefined,
    });
  });

  it('returns the canonical merged metadata and client IDs from the field update', async () => {
    workClient.updateWork.mockResolvedValue({
      metadata: { peerKey: 'peer value', localKey: 'local value' },
      clients: [{ id: 'peer-client' }, { id: 'local-client' }],
    });

    await expect(
      actions.updateWorkFieldsAction('work-1', {
        metadata: { localKey: 'local value' },
        clients: ['local-client'],
      }),
    ).resolves.toEqual({
      success: true,
      metadata: { peerKey: 'peer value', localKey: 'local value' },
      clients: ['peer-client', 'local-client'],
    });
  });

  it('preserves backend failures and stable mutation errors', async () => {
    publicWorkClient.list.mockRejectedValueOnce(new Error('offline'));
    await expect(
      actions.listWorksPublishedAction({ limit: 2, offset: 3 }).then(unwrapQueryResult),
    ).rejects.toMatchObject({ status: 500 });

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
