import { fromJson } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { FilterOp } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { ProgramEventLocationMode } from '@echovisionlab/geul-proto/public/program_event_pb.ts';
import {
  ProgramEventLocationMode as ManageLocationMode,
  ProgramEventSeriesStatus as ManageSeriesStatus,
  ProgramEventStatus as ManageStatus,
  ProgramEventTypeStatus,
} from '@echovisionlab/geul-proto/secure/program_event_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mediaDeliveryFixture } from '@/tests/helpers/media-delivery';
import * as queries from './program-event';

const mocks = vi.hoisted(() => ({
  createFileClient: vi.fn(),
  createProgramEventClient: vi.fn(),
  createProgramEventSeriesClient: vi.fn(),
  createProgramEventTypeClient: vi.fn(),
  createPublicProgramEventClient: vi.fn(),
  createPublicProgramEventClientWithAuth: vi.fn(),
  createPublicProgramEventSeriesClientWithAuth: vi.fn(),
}));

const eventClient = vi.hoisted(() => ({
  getProgramEvent: vi.fn(),
  listProgramEventsAdmin: vi.fn(),
}));

const typeClient = vi.hoisted(() => ({
  listProgramEventTypesAdmin: vi.fn(),
}));

const seriesClient = vi.hoisted(() => ({
  getProgramEventSeries: vi.fn(),
  listProgramEventSeriesAdmin: vi.fn(),
}));

const publicEventClient = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
}));

const publicSeriesClient = vi.hoisted(() => ({
  get: vi.fn(),
}));

const fileClient = vi.hoisted(() => ({
  getBulkMediaDeliveries: vi.fn(),
  getMediaDelivery: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createFileClient: mocks.createFileClient,
  createProgramEventClient: mocks.createProgramEventClient,
  createProgramEventSeriesClient: mocks.createProgramEventSeriesClient,
  createProgramEventTypeClient: mocks.createProgramEventTypeClient,
  createPublicProgramEventClient: mocks.createPublicProgramEventClient,
  createPublicProgramEventClientWithAuth: mocks.createPublicProgramEventClientWithAuth,
  createPublicProgramEventSeriesClientWithAuth: mocks.createPublicProgramEventSeriesClientWithAuth,
}));

const date = timestampFromDate(new Date('2026-01-01T00:00:00Z'));
const blockId = '019cd13a-3716-79af-8490-dbd124708824';

function localizedDocument() {
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.PROGRAM_EVENT,
    locale: 'ko',
    base: {
      nodes: [
        {
          block: { id: blockId, paragraph: { props: {} } },
          placement: { index: 0 },
        },
      ],
    },
    localeOverlay: {
      locale: 'ko',
      blocks: [
        {
          blockId,
          paragraph: { props: {}, content: [{ text: { text: 'Event content' } }] },
        },
      ],
    },
  });
}

function adminEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    title: 'Event',
    slug: undefined,
    status: ManageStatus.PUBLISHED,
    sourceLocale: 'ko',
    locales: [{ locale: 'ko', isSourceLocale: true, summary: 'Summary' }],
    typeId: 'type-1',
    seriesId: undefined,
    seriesOrder: undefined,
    startsAt: date,
    endsAt: undefined,
    timezone: 'Asia/Seoul',
    allDay: false,
    locationMode: ManageLocationMode.HYBRID,
    mapPlaceId: undefined,
    posterFileId: 'file-1',
    media: [
      {
        id: 'media-1',
        fileId: 'file-1',
        role: 'poster',
        sortOrder: 0,
        isPrimary: true,
        alt: undefined,
        caption: undefined,
      },
    ],
    ticketUrl: undefined,
    streamUrl: undefined,
    externalUrl: undefined,
    artists: [{ artistId: 'artist-1', role: undefined, sortOrder: 0 }],
    labels: [{ labelId: 'label-1', role: 'presenter', sortOrder: 0 }],
    clients: [{ clientId: 'client-1', role: undefined, sortOrder: 0 }],
    credits: [
      {
        id: 'credit-1',
        artistId: 'artist-1',
        memberId: undefined,
        displayName: undefined,
        creditRole: 'Live',
        description: undefined,
        sortOrder: 0,
        artist: { id: 'artist-1', name: 'Artist', slug: undefined, imageUrl: undefined },
        member: undefined,
      },
    ],
    publishedAt: date,
    updatedAt: undefined,
    ...overrides,
  };
}

function publicEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    title: 'Event',
    slug: undefined,
    summary: undefined,
    document: localizedDocument(),
    typeId: 'type-1',
    type: { id: 'type-1', slug: 'concert', name: 'Concert', description: undefined },
    seriesId: undefined,
    series: { id: 'series-1', slug: 'series', title: 'Series', summary: undefined },
    seriesOrder: undefined,
    startsAt: date,
    endsAt: undefined,
    timezone: 'Asia/Seoul',
    allDay: false,
    locationMode: ProgramEventLocationMode.HYBRID,
    mapPlaceId: undefined,
    locationPlace: {
      id: 'place-1',
      name: 'Place',
      lat: 37,
      lng: 127,
      googlePlaceId: undefined,
      address: undefined,
    },
    posterUrl: undefined,
    ticketUrl: undefined,
    streamUrl: undefined,
    externalUrl: undefined,
    artists: [{ id: 'artist-1', name: 'Artist', slug: undefined, role: undefined }],
    labels: [{ id: 'label-1', name: 'Label', slug: undefined, role: undefined }],
    clients: [{ id: 'client-1', name: 'Client', website: undefined, role: undefined }],
    credits: [
      {
        id: 'credit-1',
        displayName: undefined,
        creditRole: undefined,
        description: undefined,
        artist: { id: 'artist-1', name: 'Artist', slug: undefined },
        user: undefined,
      },
    ],
    publishedAt: date,
    updatedAt: undefined,
    ...overrides,
  };
}

function series(overrides: Record<string, unknown> = {}) {
  return {
    id: 'series-1',
    status: ManageSeriesStatus.PUBLISHED,
    slug: 'series',
    title: 'Series',
    summary: 'Summary',
    description: 'Description',
    posterFileId: 'file-1',
    createdAt: date,
    updatedAt: undefined,
    ...overrides,
  };
}

describe('program event queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createProgramEventClient.mockResolvedValue(eventClient);
    mocks.createProgramEventTypeClient.mockResolvedValue(typeClient);
    mocks.createProgramEventSeriesClient.mockResolvedValue(seriesClient);
    mocks.createPublicProgramEventClient.mockReturnValue(publicEventClient);
    mocks.createPublicProgramEventClientWithAuth.mockResolvedValue(publicEventClient);
    mocks.createPublicProgramEventSeriesClientWithAuth.mockResolvedValue(publicSeriesClient);
    mocks.createFileClient.mockResolvedValue(fileClient);

    eventClient.listProgramEventsAdmin.mockResolvedValue({
      events: [adminEvent()],
      pagination: { total: 1 },
    });
    eventClient.getProgramEvent.mockResolvedValue(adminEvent());
    typeClient.listProgramEventTypesAdmin.mockResolvedValue({
      types: [
        {
          id: 'type-1',
          slug: 'concert',
          status: ProgramEventTypeStatus.INACTIVE,
          sortOrder: 2,
          requiresPlace: true,
          requiresStreamUrl: false,
          locales: [{ locale: 'en', name: 'Concert', description: 'Live performance' }],
        },
      ],
    });
    seriesClient.listProgramEventSeriesAdmin.mockResolvedValue({
      series: [series()],
      pagination: { total: 1 },
    });
    seriesClient.getProgramEventSeries.mockResolvedValue(series());
    publicEventClient.list.mockResolvedValue({
      events: [publicEvent()],
      pagination: { total: 1, limit: 6, offset: 0, hasMore: false },
    });
    publicEventClient.get.mockResolvedValue({ event: publicEvent(), blockMedia: [] });
    publicSeriesClient.get.mockResolvedValue({
      series: {
        id: 'series-1',
        title: 'Series',
        slug: 'series',
        summary: undefined,
        description: undefined,
        posterAsset: { url: 'https://cdn.example/series-poster.webp' },
      },
    });
    fileClient.getBulkMediaDeliveries.mockResolvedValue({
      files: {
        'file-1': {
          delivery: mediaDeliveryFixture({
            fileId: 'file-1',
            thumbnailUrl: 'https://cdn.example/file-1.webp',
          }),
        },
      },
    });
    fileClient.getMediaDelivery.mockResolvedValue({
      delivery: mediaDeliveryFixture({
        fileId: 'file-1',
        assetUrl: 'https://cdn.example/file-1.webp',
      }),
    });
  });

  it('maps admin event, type, and series queries', async () => {
    await expect(
      queries.listProgramEventsAdmin({
        page: 2,
        pageSize: 5,
        search: 'event',
        sort: [{ field: 'starts_at', order: 'desc' }],
        filter: [
          { field: 'status', op: 'eq', value: 'published' },
          { field: 'type_id', op: 'in', value: ['type-1'] },
        ],
      }),
    ).resolves.toMatchObject({
      data: [{ id: 'event-1', status: 'published', locationMode: 'hybrid' }],
      total: 1,
      page: 2,
    });
    await expect(queries.getProgramEventAdmin('event-1')).resolves.toMatchObject({
      id: 'event-1',
      summary: 'Summary',
      posterUrl: 'https://cdn.example/file-1.webp',
      media: [{ id: 'media-1', url: 'https://cdn.example/file-1.webp' }],
      credits: [{ id: 'credit-1', artist: { id: 'artist-1' } }],
    });
    await expect(queries.listProgramEventTypesAdmin()).resolves.toEqual([
      {
        id: 'type-1',
        slug: 'concert',
        name: 'Concert',
        status: 'inactive',
        sortOrder: 2,
        requiresPlace: true,
        requiresStreamUrl: false,
        locales: [{ locale: 'en', name: 'Concert', description: 'Live performance' }],
      },
    ]);
    await expect(queries.listProgramEventSeriesAdmin()).resolves.toEqual([
      { id: 'series-1', title: 'Series', slug: 'series', status: 'published' },
    ]);
    await expect(queries.listProgramEventSeriesTableAdmin({ search: 'series' })).resolves.toMatchObject({
      data: [{ id: 'series-1', title: 'Series', status: 'published' }],
      total: 1,
    });
    await expect(queries.getProgramEventSeriesAdmin('series-1')).resolves.toMatchObject({
      id: 'series-1',
      posterUrl: 'https://cdn.example/file-1.webp',
    });
  });

  it('resolves a draft Event slug inside the manage boundary before loading the authoritative detail', async () => {
    const eventId = '00000000-0000-4000-8000-000000000016';
    eventClient.listProgramEventsAdmin.mockResolvedValueOnce({
      events: [adminEvent({ id: eventId, slug: 'event-slug', status: ManageStatus.DRAFT })],
      pagination: { total: 1 },
    });
    eventClient.getProgramEvent.mockResolvedValueOnce(
      adminEvent({ id: eventId, slug: 'event-slug', status: ManageStatus.DRAFT }),
    );

    await expect(queries.getProgramEventAdmin('event-slug')).resolves.toMatchObject({
      id: eventId,
      slug: 'event-slug',
      status: 'draft',
    });
    expect(eventClient.listProgramEventsAdmin).toHaveBeenCalledWith({
      pagination: { limit: 1, offset: 0 },
      filters: [expect.objectContaining({ field: 'slug', op: FilterOp.EQ, value: 'event-slug' })],
    });
    expect(eventClient.getProgramEvent).toHaveBeenCalledWith({ id: eventId });
    expect(publicEventClient.get).not.toHaveBeenCalled();
  });

  it('returns no manage Event when slug resolution is not authorized', async () => {
    eventClient.listProgramEventsAdmin.mockRejectedValueOnce(new ConnectError('forbidden', Code.PermissionDenied));

    await expect(queries.getProgramEventAdmin('private-event')).resolves.toBeNull();
    expect(eventClient.getProgramEvent).not.toHaveBeenCalled();
    expect(publicEventClient.get).not.toHaveBeenCalled();
  });

  it('maps public block, event view, and series view queries', async () => {
    await expect(
      queries.listProgramEventsForBlock({
        search: ' event ',
        typeIds: ['type-1'],
        seriesId: 'series-1',
        locationModes: ['hybrid'],
        timeWindow: 'upcoming',
        sortBy: 'starts_at',
        sortOrder: 'asc',
        requestedLocale: 'ko',
      }),
    ).resolves.toMatchObject({
      events: [{ id: 'event-1', typeName: 'Concert', locationMode: 'hybrid' }],
      pagination: { total: 1, hasMore: false },
    });
    await expect(
      queries.listProgramEventsForSeries({ seriesId: 'series-1', requestedLocale: 'ko' }),
    ).resolves.toMatchObject({ events: [{ id: 'event-1' }] });
    await expect(queries.getProgramEventView('event-1', { requestedLocale: 'ko' })).resolves.toMatchObject({
      id: 'event-1',
      content: [{ id: blockId, kind: 'paragraph' }],
      blockMedia: [],
      type: { id: 'type-1' },
      series: { id: 'series-1' },
      locationPlace: { id: 'place-1', googlePlaceId: null },
      credits: [{ id: 'credit-1', artist: { id: 'artist-1' } }],
    });
    await expect(queries.getProgramEventSeriesView('series-1')).resolves.toEqual({
      id: 'series-1',
      title: 'Series',
      slug: 'series',
      summary: null,
      description: null,
      posterUrl: 'https://cdn.example/series-poster.webp',
    });
  });

  it('maps status filter values and handled public failures', async () => {
    expect(queries.toManageProgramEventStatusFilterValue('draft')).toBe('PROGRAM_EVENT_STATUS_DRAFT');
    expect(queries.toManageProgramEventStatusFilterValue('published')).toBe('PROGRAM_EVENT_STATUS_PUBLISHED');
    expect(queries.toManageProgramEventStatusFilterValue('archived')).toBe('PROGRAM_EVENT_STATUS_ARCHIVED');
    expect(queries.toManageProgramEventSeriesStatusFilterValue('draft')).toBe('PROGRAM_EVENT_SERIES_STATUS_DRAFT');
    expect(queries.toManageProgramEventSeriesStatusFilterValue('published')).toBe(
      'PROGRAM_EVENT_SERIES_STATUS_PUBLISHED',
    );

    publicEventClient.get.mockRejectedValueOnce(new ConnectError('missing', Code.NotFound));
    await expect(queries.getProgramEventView('missing')).resolves.toBeNull();

    publicSeriesClient.get.mockRejectedValueOnce(new Error('offline'));
    await expect(queries.getProgramEventSeriesView('missing')).resolves.toBeNull();
  });
});
