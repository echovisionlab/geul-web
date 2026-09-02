import { Code, ConnectError } from '@connectrpc/connect';
import {
  ProgramEventLocationMode,
  ProgramEventSeriesStatus,
  ProgramEventTypeStatus,
} from '@echovisionlab/geul-proto/secure/program_event_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mediaDeliveryFixture } from '@/tests/helpers/media-delivery';
import * as actions from './program-event';

const mocks = vi.hoisted(() => ({
  createArtistClient: vi.fn(),
  createFileClient: vi.fn(),
  createProgramEventClient: vi.fn(),
  createProgramEventSeriesClient: vi.fn(),
  createProgramEventTypeClient: vi.fn(),
  getUserLocale: vi.fn(),
  revalidatePath: vi.fn(),
}));

const eventClient = vi.hoisted(() => ({
  addProgramEventCredit: vi.fn(),
  addProgramEventMedia: vi.fn(),
  archiveProgramEvent: vi.fn(),
  createProgramEvent: vi.fn(),
  deleteProgramEvent: vi.fn(),
  deleteProgramEventCredit: vi.fn(),
  deleteProgramEventMedia: vi.fn(),
  getProgramEvent: vi.fn(),
  publishProgramEvent: vi.fn(),
  reorderProgramEventCredits: vi.fn(),
  reorderProgramEventMedia: vi.fn(),
  updateProgramEvent: vi.fn(),
  updateProgramEventCredit: vi.fn(),
}));

const typeClient = vi.hoisted(() => ({
  createProgramEventType: vi.fn(),
  deleteProgramEventType: vi.fn(),
  listProgramEventTypesAdmin: vi.fn(),
  updateProgramEventType: vi.fn(),
}));

const seriesClient = vi.hoisted(() => ({
  createProgramEventSeries: vi.fn(),
  deleteProgramEventSeries: vi.fn(),
  updateProgramEventSeries: vi.fn(),
}));

const fileClient = vi.hoisted(() => ({
  getBulkMediaDeliveries: vi.fn(),
  getMediaDelivery: vi.fn(),
}));

const artistClient = vi.hoisted(() => ({
  listArtists: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/lib/api/server-client', () => ({
  createArtistClient: mocks.createArtistClient,
  createFileClient: mocks.createFileClient,
  createProgramEventClient: mocks.createProgramEventClient,
  createProgramEventSeriesClient: mocks.createProgramEventSeriesClient,
  createProgramEventTypeClient: mocks.createProgramEventTypeClient,
}));

vi.mock('@/lib/utils/language.server', () => ({
  getUserLocale: mocks.getUserLocale,
}));

function credit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'credit-1',
    artistId: 'artist-1',
    memberId: undefined,
    displayName: undefined,
    creditRole: 'Live',
    description: undefined,
    sortOrder: 1,
    artist: { id: 'artist-1', name: 'Artist', slug: undefined, imageUrl: undefined },
    member: undefined,
    ...overrides,
  };
}

const posterMedia = [
  {
    id: 'media-1',
    fileId: 'file-1',
    role: 'poster',
    sortOrder: 1,
    isPrimary: false,
    alt: undefined,
    caption: undefined,
  },
  {
    id: 'media-2',
    fileId: 'file-2',
    role: 'poster',
    sortOrder: 0,
    isPrimary: true,
    alt: 'Alt',
    caption: 'Caption',
  },
  {
    id: 'media-3',
    fileId: 'file-3',
    role: 'gallery',
    sortOrder: 0,
    isPrimary: false,
  },
];

describe('program event actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    mocks.getUserLocale.mockResolvedValue('ko');
    mocks.createProgramEventClient.mockResolvedValue(eventClient);
    mocks.createProgramEventTypeClient.mockResolvedValue(typeClient);
    mocks.createProgramEventSeriesClient.mockResolvedValue(seriesClient);
    mocks.createFileClient.mockResolvedValue(fileClient);
    mocks.createArtistClient.mockResolvedValue(artistClient);
    typeClient.listProgramEventTypesAdmin.mockResolvedValue({ types: [{ id: 'type-1' }] });
    typeClient.createProgramEventType.mockResolvedValue({ id: 'type-created' });
    typeClient.deleteProgramEventType.mockResolvedValue({ success: true });
    typeClient.updateProgramEventType.mockResolvedValue({ id: 'type-1' });
    eventClient.createProgramEvent.mockResolvedValue({ id: 'event-1' });
    eventClient.addProgramEventMedia.mockResolvedValue({ media: posterMedia[0] });
    eventClient.deleteProgramEventMedia.mockResolvedValue({ eventId: 'event-1', mediaId: 'media-1', changed: true });
    eventClient.reorderProgramEventMedia.mockResolvedValue({
      eventId: 'event-1',
      role: 'poster',
      mediaIds: ['media-2', 'media-1'],
      changed: true,
    });
    eventClient.getProgramEvent.mockResolvedValue({ media: posterMedia });
    eventClient.addProgramEventCredit.mockResolvedValue(credit());
    eventClient.updateProgramEventCredit.mockResolvedValue(
      credit({
        memberId: 'member-1',
        member: { id: 'member-1', nickname: 'Member', deleted: false },
        artist: undefined,
      }),
    );
    fileClient.getBulkMediaDeliveries.mockResolvedValue({
      files: {
        'file-1': {
          delivery: mediaDeliveryFixture({
            fileId: 'file-1',
            assetUrl: 'https://cdn.example/file-1.webp',
          }),
        },
        'file-2': {
          delivery: mediaDeliveryFixture({
            fileId: 'file-2',
            thumbnailUrl: 'https://cdn.example/file-2-thumb.webp',
          }),
        },
      },
    });
    fileClient.getMediaDelivery.mockResolvedValue({
      delivery: mediaDeliveryFixture({
        fileId: 'file-1',
        assetUrl: 'https://cdn.example/series.webp',
      }),
    });
    artistClient.listArtists.mockResolvedValue({
      artists: [{ id: 'artist-1', name: 'Artist', imageUrl: undefined }],
    });
    seriesClient.createProgramEventSeries.mockResolvedValue({ id: 'series-1' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates, updates, publishes, archives, and deletes program events', async () => {
    await expect(actions.createProgramEventAction('Asia/Seoul')).resolves.toEqual({
      data: { id: 'event-1' },
    });
    await expect(
      actions.updateProgramEventAction('event-1', {
        title: 'Show',
        slug: ' Show Slug ',
        summary: null,
        seriesId: null,
        seriesOrder: null,
        startsAt: new Date('2026-01-01T10:00:00Z'),
        endsAt: null,
        timezone: 'Asia/Seoul',
        allDay: true,
        locationMode: 'hybrid',
        mapPlaceId: null,
        posterFileId: null,
        ticketUrl: null,
        streamUrl: null,
        externalUrl: null,
        locale: 'ko',
        artists: [{ id: 'artist-1', role: 'performer' }],
        labels: [{ id: 'label-1' }],
        clients: [{ id: 'client-1' }],
        credits: [{ artistId: 'artist-1', creditRole: 'Live' }],
      }),
    ).resolves.toEqual({ success: true });
    await expect(actions.publishProgramEventAction('event-1')).resolves.toEqual({ success: true });
    await expect(actions.archiveProgramEventAction('event-1')).resolves.toEqual({ success: true });
    await expect(actions.deleteProgramEventAction('event-1')).resolves.toEqual({ success: true });

    expect(eventClient.createProgramEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLocale: 'ko',
        typeId: 'type-1',
        timezone: 'Asia/Seoul',
        locationMode: ProgramEventLocationMode.TBA,
      }),
    );
    expect(eventClient.updateProgramEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'event-1',
        slug: ' Show Slug ',
        seriesId: '',
        clearSeriesOrder: true,
        clearEndsAt: true,
        locationMode: ProgramEventLocationMode.HYBRID,
        replaceArtists: true,
        replaceLabels: true,
        replaceClients: true,
        replaceCredits: true,
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/events');
  });

  it('hydrates poster media and maps credit operations', async () => {
    await expect(actions.addProgramEventPosterAction('event-1', 'file-1')).resolves.toEqual({
      imageUrl: 'https://cdn.example/file-2-thumb.webp',
      media: [
        {
          id: 'media-2',
          fileId: 'file-2',
          url: 'https://cdn.example/file-2-thumb.webp',
          role: 'poster',
          sortOrder: 0,
          isPrimary: true,
          alt: 'Alt',
          caption: 'Caption',
        },
        expect.objectContaining({ id: 'media-1', url: 'https://cdn.example/file-1.webp' }),
      ],
    });
    await expect(actions.deleteProgramEventPosterAction('event-1', 'media-1')).resolves.toMatchObject({
      imageUrl: 'https://cdn.example/file-2-thumb.webp',
    });
    const reordered = await actions.reorderProgramEventPosterMediaAction('event-1', ['media-2', 'media-1']);
    expect(reordered.media?.[0]).toEqual(expect.objectContaining({ id: 'media-2' }));
    await expect(
      actions.addProgramEventCreditAction('event-1', {
        artistId: 'artist-1',
        creditRole: null,
        description: null,
      }),
    ).resolves.toMatchObject({ credit: { id: 'credit-1', artist: { id: 'artist-1' } } });
    await expect(
      actions.updateProgramEventCreditAction('event-1', 'credit-1', {
        creditRole: null,
        description: null,
      }),
    ).resolves.toMatchObject({ credit: { id: 'credit-1', member: { id: 'member-1' } } });
    await expect(actions.deleteProgramEventCreditAction('event-1', 'credit-1')).resolves.toEqual({
      success: true,
    });
    await expect(actions.reorderProgramEventCreditsAction('event-1', ['credit-1'])).resolves.toEqual({ success: true });
  });

  it('creates event types and series records, searches artists, and maps series poster actions', async () => {
    typeClient.listProgramEventTypesAdmin.mockResolvedValueOnce({ types: [] });
    await expect(actions.createProgramEventAction()).resolves.toEqual({ data: { id: 'event-1' } });
    expect(typeClient.createProgramEventType).toHaveBeenCalledWith({
      slug: 'event',
      locale: 'ko',
      name: 'Event',
      sortOrder: 0,
    });

    await expect(
      actions.createProgramEventTypeAction({
        name: ' Listening Party ',
        slug: ' party ',
        sortOrder: 2,
      }),
    ).resolves.toEqual({
      data: { id: 'type-created', name: 'Listening Party', slug: 'party' },
    });
    await expect(
      actions.updateProgramEventTypeAction('type-1', {
        locale: 'ko',
        name: '공연',
        description: null,
        slug: 'concert',
        status: 'inactive',
        sortOrder: 3,
        requiresPlace: true,
        requiresStreamUrl: false,
      }),
    ).resolves.toEqual({ success: true });
    expect(typeClient.updateProgramEventType).toHaveBeenCalledWith({
      id: 'type-1',
      locale: 'ko',
      name: '공연',
      description: '',
      slug: 'concert',
      status: ProgramEventTypeStatus.INACTIVE,
      sortOrder: 3,
      requiresPlace: true,
      requiresStreamUrl: false,
    });
    await expect(actions.deleteProgramEventTypeAction('type-1')).resolves.toEqual({ success: true });
    expect(typeClient.deleteProgramEventType).toHaveBeenCalledWith({ id: 'type-1' });
    await expect(actions.createProgramEventSeriesAction()).resolves.toEqual({
      data: { id: 'series-1' },
    });
    await expect(
      actions.updateProgramEventSeriesAction('series-1', {
        title: 'Series',
        summary: null,
        description: null,
        posterFileId: null,
        status: 'published',
      }),
    ).resolves.toEqual({ success: true });
    expect(seriesClient.updateProgramEventSeries).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ProgramEventSeriesStatus.PUBLISHED,
        summary: '',
        description: '',
        posterFileId: '',
      }),
    );
    await expect(actions.setProgramEventSeriesPosterAction('series-1', 'file-1')).resolves.toEqual({
      imageUrl: 'https://cdn.example/series.webp',
    });
    await expect(actions.removeProgramEventSeriesPosterAction('series-1')).resolves.toEqual({
      success: true,
    });
    await expect(actions.deleteProgramEventSeriesAction('series-1')).resolves.toEqual({
      success: true,
    });
    await expect(actions.searchArtistsForProgramEventCreditAction('event-1', ' Artist ')).resolves.toEqual([
      { id: 'artist-1', name: 'Artist', imageUrl: null },
    ]);
    await expect(actions.searchArtistsForProgramEventCreditAction('event-1', '   ')).resolves.toEqual([]);
  });

  it('maps auth and permission failures to Unauthorized', async () => {
    eventClient.publishProgramEvent.mockRejectedValueOnce(new ConnectError('denied', Code.PermissionDenied));
    await expect(actions.publishProgramEventAction('event-1')).resolves.toEqual({
      error: 'Unauthorized',
    });
  });
});
