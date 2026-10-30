import { unwrapQueryResult } from '@/lib/api/query-result';
import { Code, ConnectError } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { FilterOp, FilterSpecSchema } from '@echovisionlab/geul-proto/common/common_pb.ts';
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
  listProgramEventTypesAdmin: vi.fn(),
  updateProgramEventType: vi.fn(),
}));

const seriesClient = vi.hoisted(() => ({
  updateProgramEventSeries: vi.fn(),
}));

const fileClient = vi.hoisted(() => ({
  getBulkMediaDeliveries: vi.fn(),
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
  it.each(['publishProgramEventAction', 'archiveProgramEventAction'] as const)(
    'forwards lifecycle origin for %s',
    async (action) => {
      const origin = '40000000-0000-4000-8000-000000000001';
      await expect(actions[action]('entity-1', origin)).resolves.toEqual({ ok: true, success: true });
      expect(mocks.createProgramEventClient).toHaveBeenCalledWith(origin);
    },
  );

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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the canonical neutral Event configuration without media hydration', async () => {
    const startsAt = new Date('2026-08-01T10:30:00.000Z');
    const endsAt = new Date('2026-08-01T12:00:00.000Z');
    eventClient.getProgramEvent.mockResolvedValueOnce({
      slug: 'summer-show',
      typeId: 'type-new',
      sourceLocale: 'en',
      seriesId: 'series-1',
      seriesOrder: 2,
      startsAt: timestampFromDate(startsAt),
      endsAt: timestampFromDate(endsAt),
      timezone: 'Asia/Seoul',
      allDay: false,
      locationMode: ProgramEventLocationMode.HYBRID,
      mapPlaceId: 'place-1',
      ticketUrl: 'https://tickets.example/show',
      streamUrl: 'https://stream.example/show',
      externalUrl: 'https://example/show',
      artists: [{ artistId: 'artist-1', role: 'performer', sortOrder: 4 }],
      labels: [{ labelId: 'label-1', role: '', sortOrder: 7 }],
      clients: [{ clientId: 'client-1', role: 'host', sortOrder: 9 }],
    });
    typeClient.listProgramEventTypesAdmin.mockResolvedValueOnce({
      types: [
        {
          id: 'type-new',
          slug: 'summer-event',
          locales: [
            { locale: 'en', name: 'Summer Event' },
            { locale: 'ko', name: '새로 만든 이벤트 종류' },
          ],
        },
      ],
    });

    await expect(actions.getProgramEventNeutralConfigurationAction('event-1')).resolves.toEqual({
      ok: true,
      configuration: {
        slug: 'summer-show',
        typeId: 'type-new',
        typeName: '새로 만든 이벤트 종류',
        seriesId: 'series-1',
        seriesOrder: 2,
        startsAt,
        endsAt,
        timezone: 'Asia/Seoul',
        allDay: false,
        locationMode: 'hybrid',
        mapPlaceId: 'place-1',
        ticketUrl: 'https://tickets.example/show',
        streamUrl: 'https://stream.example/show',
        externalUrl: 'https://example/show',
        artists: [{ id: 'artist-1', role: 'performer', sortOrder: 4 }],
        labels: [{ id: 'label-1', role: null, sortOrder: 7 }],
        clients: [{ id: 'client-1', role: 'host', sortOrder: 9 }],
      },
    });
    expect(eventClient.getProgramEvent).toHaveBeenCalledWith({ id: 'event-1' });
    expect(typeClient.listProgramEventTypesAdmin).toHaveBeenCalledWith({
      pagination: { limit: 1, offset: 0 },
      filters: [create(FilterSpecSchema, { field: 'id', op: FilterOp.EQ, value: 'type-new' })],
    });
    expect(mocks.createFileClient).not.toHaveBeenCalled();
  });

  it('keeps canonical Event settings when the optional type label lookup is denied', async () => {
    eventClient.getProgramEvent.mockResolvedValueOnce({
      slug: 'summer-show',
      typeId: 'type-new',
      seriesId: 'series-1',
      seriesOrder: 2,
      timezone: 'Asia/Seoul',
      allDay: false,
      locationMode: ProgramEventLocationMode.HYBRID,
      artists: [],
      labels: [],
      clients: [],
    });
    typeClient.listProgramEventTypesAdmin.mockRejectedValueOnce(new ConnectError('denied', Code.PermissionDenied));

    await expect(actions.getProgramEventNeutralConfigurationAction('event-1')).resolves.toMatchObject({
      ok: true,
      configuration: {
        slug: 'summer-show',
        typeId: 'type-new',
        typeName: null,
        timezone: 'Asia/Seoul',
        seriesId: 'series-1',
      },
    });
  });

  it('reports authorized getter failures without claiming canonical data', async () => {
    eventClient.getProgramEvent.mockRejectedValueOnce(new ConnectError('denied', Code.PermissionDenied));

    await expect(actions.getProgramEventNeutralConfigurationAction('event-1')).resolves.toEqual({
      ok: false,
      error: 'Unauthorized',
      errorCode: Code.PermissionDenied,
    });
  });

  it('creates an event in the editor locale with an existing type, the given timezone and TBA location', async () => {
    await expect(actions.createProgramEventAction('Asia/Seoul')).resolves.toEqual({
      ok: true,
      data: { id: 'event-1' },
    });

    expect(typeClient.createProgramEventType).not.toHaveBeenCalled();
    expect(eventClient.createProgramEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLocale: 'ko',
        typeId: 'type-1',
        timezone: 'Asia/Seoul',
        locationMode: ProgramEventLocationMode.TBA,
      }),
    );
  });

  it('creates a default event type before the first event when none exists', async () => {
    typeClient.listProgramEventTypesAdmin.mockResolvedValueOnce({ types: [] });

    await expect(actions.createProgramEventAction()).resolves.toEqual({ ok: true, data: { id: 'event-1' } });

    expect(typeClient.createProgramEventType).toHaveBeenCalledWith({
      slug: 'event',
      locale: 'ko',
      name: 'Event',
      sortOrder: 0,
    });
    expect(eventClient.createProgramEvent).toHaveBeenCalledWith(expect.objectContaining({ typeId: 'type-created' }));
  });

  it('clears the series, series order and end time when they are removed', async () => {
    await expect(
      actions.updateProgramEventAction('event-1', { seriesId: null, seriesOrder: null, endsAt: null }),
    ).resolves.toEqual({ ok: true, success: true });

    const update = eventClient.updateProgramEvent.mock.lastCall?.[0];
    expect(update).toMatchObject({ id: 'event-1', seriesId: '', clearSeriesOrder: true, clearEndsAt: true });
    expect(update?.seriesOrder).toBeUndefined();
    expect(update?.endsAt).toBeUndefined();
  });

  it.each([
    ['map_place', ProgramEventLocationMode.MAP_PLACE],
    ['online', ProgramEventLocationMode.ONLINE],
    ['hybrid', ProgramEventLocationMode.HYBRID],
    ['tba', ProgramEventLocationMode.TBA],
  ] as const)('saves location mode %s as the matching wire mode', async (locationMode, expected) => {
    await actions.updateProgramEventAction('event-1', { locationMode });

    expect(eventClient.updateProgramEvent).toHaveBeenCalledWith(expect.objectContaining({ locationMode: expected }));
  });

  it('serializes a single Program Event relation replacement without replacing sibling collections', async () => {
    await expect(
      actions.updateProgramEventAction('event-1', {
        artists: [{ id: 'artist-1', role: 'performer' }],
        observed: { artists: [{ id: 'artist-1', role: 'performer', sortOrder: 4 }] },
      }),
    ).resolves.toEqual({ ok: true, success: true });

    expect(eventClient.updateProgramEvent).toHaveBeenCalledOnce();
    const update = eventClient.updateProgramEvent.mock.lastCall?.[0];
    expect(update?.artists).toHaveLength(1);
    expect(update?.artists[0]).toMatchObject({ artistId: 'artist-1', role: 'performer', sortOrder: 0 });
    expect(update?.labels).toHaveLength(0);
    expect(update?.clients).toHaveLength(0);
    expect(update?.replaceArtists).toBe(true);
    expect(update?.replaceLabels).toBe(false);
    expect(update?.replaceClients).toBe(false);
    expect(update?.observedArtists?.artists).toMatchObject([{ artistId: 'artist-1', role: 'performer', sortOrder: 4 }]);
    expect(update?.observedLabels).toBeUndefined();
    expect(update?.observedClients).toBeUndefined();
  });

  it('preserves an explicitly empty observed Program Event collection snapshot', async () => {
    await expect(
      actions.updateProgramEventAction('event-1', {
        artists: [{ id: 'artist-1', sortOrder: 0 }],
        observed: { artists: [] },
      }),
    ).resolves.toEqual({ ok: true, success: true });

    const update = eventClient.updateProgramEvent.mock.lastCall?.[0];
    expect(update?.observedArtists).toMatchObject({ artists: [] });
  });

  it('serializes presence-bearing observed snapshots for all Program Event relation collections', async () => {
    await expect(
      actions.updateProgramEventAction('event-1', {
        artists: [{ id: 'artist-next' }],
        labels: [{ id: 'label-next' }],
        clients: [{ id: 'client-next' }],
        observed: {
          artists: [{ id: 'artist-before', role: 'performer', sortOrder: 2 }],
          labels: [],
          clients: [{ id: 'client-before', role: 'host', sortOrder: 7 }],
        },
      }),
    ).resolves.toEqual({ ok: true, success: true });

    const update = eventClient.updateProgramEvent.mock.lastCall?.[0];
    expect(update?.observedArtists?.artists).toMatchObject([
      { artistId: 'artist-before', role: 'performer', sortOrder: 2 },
    ]);
    expect(update?.observedLabels).toMatchObject({ labels: [] });
    expect(update?.observedClients?.clients).toMatchObject([{ clientId: 'client-before', role: 'host', sortOrder: 7 }]);
  });

  it('hydrates poster media and maps credit operations', async () => {
    await expect(actions.addProgramEventPosterAction('event-1', 'file-1')).resolves.toEqual({
      ok: true,
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
      ok: true,
      success: true,
    });
    await expect(actions.reorderProgramEventCreditsAction('event-1', ['credit-1'])).resolves.toEqual({
      ok: true,
      success: true,
    });
  });

  it('trims the name and slug of a new event type', async () => {
    await expect(
      actions.createProgramEventTypeAction({ name: ' Listening Party ', slug: ' party ', sortOrder: 2 }),
    ).resolves.toEqual({
      ok: true,
      data: { id: 'type-created', name: 'Listening Party', slug: 'party' },
    });

    expect(typeClient.createProgramEventType).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Listening Party', slug: 'party', locale: 'ko', sortOrder: 2 }),
    );
  });

  it.each([
    ['inactive', ProgramEventTypeStatus.INACTIVE],
    ['active', ProgramEventTypeStatus.ACTIVE],
  ] as const)('clears the event type description and saves status %s', async (status, expected) => {
    await expect(
      actions.updateProgramEventTypeAction('type-1', {
        locale: 'ko',
        name: '공연',
        description: null,
        slug: 'concert',
        status,
        sortOrder: 3,
        requiresPlace: true,
        requiresStreamUrl: false,
      }),
    ).resolves.toEqual({ ok: true, success: true });

    expect(typeClient.updateProgramEventType).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'type-1', description: '', status: expected }),
    );
  });

  it.each([
    ['published', ProgramEventSeriesStatus.PUBLISHED],
    ['draft', ProgramEventSeriesStatus.DRAFT],
  ] as const)('clears series summary, description and poster and saves status %s', async (status, expected) => {
    await expect(
      actions.updateProgramEventSeriesAction('series-1', {
        summary: null,
        description: null,
        posterFileId: null,
        status,
      }),
    ).resolves.toEqual({ ok: true, success: true });

    expect(seriesClient.updateProgramEventSeries).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'series-1',
        summary: '',
        description: '',
        posterFileId: '',
        status: expected,
      }),
    );
  });

  it('returns no artists for a blank credit search without querying the backend', async () => {
    await expect(
      actions.searchArtistsForProgramEventCreditAction('event-1', '   ').then(unwrapQueryResult),
    ).resolves.toEqual([]);

    expect(artistClient.listArtists).not.toHaveBeenCalled();
  });

  it('maps auth and permission failures to Unauthorized', async () => {
    eventClient.publishProgramEvent.mockRejectedValueOnce(new ConnectError('denied', Code.PermissionDenied));
    await expect(actions.publishProgramEventAction('event-1')).resolves.toEqual({
      ok: false,
      error: 'Unauthorized',
      errorCode: Code.PermissionDenied,
    });
  });
});
