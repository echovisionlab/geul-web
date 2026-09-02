import { fromJson } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  WorkStatus as PublicWorkStatus,
  WorkType as PublicWorkType,
} from '@echovisionlab/geul-proto/public/work_pb.ts';
import { WorkStatus, WorkType } from '@echovisionlab/geul-proto/secure/work_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as queries from './work';

const mocks = vi.hoisted(() => ({
  createPublicWorkClient: vi.fn(),
  createPublicWorkClientWithAuth: vi.fn(),
  createWorkClient: vi.fn(),
  loggerError: vi.fn(),
}));

const workClient = vi.hoisted(() => ({
  getWork: vi.fn(),
}));

const publicWorkClient = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
  listMapFeatures: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createPublicWorkClient: mocks.createPublicWorkClient,
  createPublicWorkClientWithAuth: mocks.createPublicWorkClientWithAuth,
  createWorkClient: mocks.createWorkClient,
}));

vi.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({ error: mocks.loggerError }),
}));

const date = timestampFromDate(new Date('2026-01-01T00:00:00Z'));
const blockId = '019cd13a-3716-79af-8490-dbd124708824';

function localizedDocument() {
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.WORK,
    locale: 'ko',
    base: {
      nodes: [{ block: { id: blockId, paragraph: { props: {} } }, placement: { index: 0 } }],
    },
    localeOverlay: {
      locale: 'ko',
      blocks: [
        {
          blockId,
          paragraph: { props: {}, content: [{ text: { text: 'Work content' } }] },
        },
      ],
    },
  });
}

function publicWork(overrides: Record<string, unknown> = {}) {
  return {
    id: 'work-1',
    title: 'Work',
    slug: undefined,
    type: PublicWorkType.PORTFOLIO,
    year: 2026,
    month: 1,
    untilYear: undefined,
    untilMonth: undefined,
    isPresent: true,
    summary: undefined,
    mapPlaceId: undefined,
    locationPlace: { name: 'Place', lat: 37, lng: 127, googlePlaceId: undefined },
    featuredImageUrl: undefined,
    metadata: { role: 'sound' },
    featured: true,
    status: PublicWorkStatus.PUBLISHED,
    document: localizedDocument(),
    createdAt: date,
    updatedAt: undefined,
    publishedAt: date,
    creditGroups: [{ id: 'group-1', name: 'Band', sortOrder: 0 }],
    credits: [
      {
        id: 'credit-1',
        groupId: undefined,
        name: undefined,
        creditRole: 'Role',
        sortOrder: 0,
        artist: { id: 'artist-1', name: 'Artist', slug: undefined, imageUrl: undefined },
        user: undefined,
      },
    ],
    clients: [{ id: 'client-1', name: 'Client', logoUrl: undefined, website: undefined }],
    ...overrides,
  };
}

function adminWork(overrides: Record<string, unknown> = {}) {
  return {
    id: 'work-1',
    title: 'Work',
    slug: undefined,
    type: WorkType.ARTICLE,
    year: 2026,
    month: 1,
    untilYear: undefined,
    untilMonth: undefined,
    isPresent: true,
    summary: undefined,
    mapPlaceId: undefined,
    featuredImageUrl: undefined,
    metadata: {},
    featured: false,
    status: WorkStatus.DRAFT,
    contentHtml: '<p>Work</p>',
    createdAt: date,
    updatedAt: undefined,
    publishedAt: undefined,
    ogImageUrl: undefined,
    clients: [{ id: 'client-1', name: 'Client', logoUrl: undefined, website: undefined }],
    ...overrides,
  };
}

describe('work queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createWorkClient.mockResolvedValue(workClient);
    mocks.createPublicWorkClient.mockReturnValue(publicWorkClient);
    mocks.createPublicWorkClientWithAuth.mockResolvedValue(publicWorkClient);
    publicWorkClient.get.mockResolvedValue({
      work: publicWork(),
      blockMedia: [],
    });
    publicWorkClient.list.mockResolvedValue({
      works: [publicWork()],
      pagination: { total: 1 },
    });
    publicWorkClient.listMapFeatures.mockResolvedValue({
      clusters: [
        {
          id: 'cluster-1',
          lat: 37,
          lng: 127,
          placeCount: 2,
          workCount: 3,
          minBreakoutZoom: undefined,
          bounds: undefined,
        },
      ],
      items: [
        {
          placeId: 'place-1',
          name: 'Place',
          address: 'Seoul',
          lat: 37.5,
          lng: 127.1,
          workCount: 1,
          primaryWorkId: 'work-1',
          primaryWorkSlug: undefined,
          primaryWorkTitle: 'Work',
        },
      ],
    });
    workClient.getWork.mockResolvedValue(adminWork());
  });

  it('maps public work detail and share-token detail', async () => {
    await expect(queries.getWorkView('work-1', { requestedLocale: 'ko' })).resolves.toMatchObject({
      id: 'work-1',
      type: 'portfolio',
      status: 'published',
      content: [{ id: blockId, kind: 'paragraph' }],
      locationPlace: { name: 'Place', googlePlaceId: null },
      creditGroups: [{ id: 'group-1', name: 'Band' }],
      credits: [{ id: 'credit-1', artist: { id: 'artist-1' } }],
      clients: [{ id: 'client-1', logoUrl: null }],
    });
    await expect(queries.getWorkViewWithShareToken('work-1', 'token', 'ko', 'secret')).resolves.toMatchObject({
      id: 'work-1',
      type: 'portfolio',
    });
    expect(publicWorkClient.get).toHaveBeenLastCalledWith({
      slug: 'work-1',
      shareToken: 'token',
      sharePassword: 'secret',
    });
  });

  it('maps admin/edit detail, galleries, maps, and tables', async () => {
    await expect(queries.getWorkForEdit('work-1')).resolves.toMatchObject({
      id: 'work-1',
      type: 'article',
      clientIds: ['client-1'],
    });
    await expect(
      queries.listWorksForGallery({
        types: ['portfolio'],
        featuredOnly: true,
        year: 2026,
        month: 1,
        requestedLocale: 'ko',
        sortBy: 'published_at',
        sortOrder: 'asc',
      }),
    ).resolves.toMatchObject({
      works: [{ id: 'work-1', type: 'portfolio', featured: true }],
      pagination: { total: 1, limit: 20, offset: 0 },
    });
    await expect(
      queries.listWorkMapFeatures({
        requestedLocale: 'ko',
        types: ['portfolio'],
        featuredOnly: true,
        sortBy: 'title',
        viewport: {
          bounds: { west: 120, south: 30, east: 130, north: 40 },
          zoom: 8,
          widthPx: 300.4,
          heightPx: 200.6,
          clusterRadiusPx: 40.2,
          minClusterPoints: 2.1,
        },
      }),
    ).resolves.toMatchObject({
      clusters: [{ id: 'cluster-1', bounds: { west: 127, south: 37, east: 127, north: 37 } }],
      items: [{ placeId: 'place-1', primaryWorkSlug: null }],
    });
    await expect(
      queries.listPublishedWorksTable({
        query: { page: 1, pageSize: 10 },
        types: ['portfolio'],
        featuredOnly: true,
        statuses: ['published'],
      }),
    ).resolves.toMatchObject({
      data: [{ id: 'work-1', type: 'portfolio', publishedAt: '2026-01-01T00:00:00.000Z' }],
      total: 1,
    });
  });

  it('resolves an authorized edit slug to the manage Work ID', async () => {
    const workId = '00000000-0000-4000-8000-000000000002';
    publicWorkClient.get.mockResolvedValueOnce({ work: publicWork({ id: workId, slug: 'work-slug' }) });
    workClient.getWork.mockResolvedValueOnce(adminWork({ id: workId, slug: 'work-slug' }));

    await expect(queries.getWorkForEdit('work-slug')).resolves.toMatchObject({ id: workId, slug: 'work-slug' });

    expect(publicWorkClient.get).toHaveBeenCalledWith({ slug: 'work-slug' });
    expect(workClient.getWork).toHaveBeenCalledWith({ id: workId });
  });

  it('returns null or empty fallbacks for handled failures', async () => {
    workClient.getWork.mockRejectedValueOnce(new ConnectError('missing', Code.NotFound));
    await expect(queries.getWorkForEdit('missing')).resolves.toBeNull();

    publicWorkClient.list.mockRejectedValueOnce(new Error('offline'));
    await expect(queries.listWorksForGallery({ limit: 2, offset: 3 })).resolves.toEqual({
      works: [],
      pagination: { total: 0, limit: 2, offset: 3 },
    });
  });
});
