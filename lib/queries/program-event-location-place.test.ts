import { ProgramEventLocationMode } from '@echovisionlab/geul-proto/public/program_event_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicProgramEventClientWithAuth } from '@/lib/api/server-client';
import { getProgramEventView } from './program-event';

const getProgramEventMock = vi.fn();

vi.mock('@/lib/api/server-client', () => ({
  createPublicProgramEventClientWithAuth: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/queries/localized-public', () => ({
  mapPublicLocalizationInfo: vi.fn(() => null),
  maybeFetchSourceLocale: vi.fn(async ({ initialResponse }) => initialResponse),
}));

vi.mock('@/lib/queries/media-content-hydration', () => ({}));

beforeEach(() => {
  getProgramEventMock.mockReset();
  vi.mocked(createPublicProgramEventClientWithAuth).mockResolvedValue({
    get: getProgramEventMock,
  } as unknown as Awaited<ReturnType<typeof createPublicProgramEventClientWithAuth>>);
});

describe('getProgramEventView location place mapping', () => {
  it('preserves Google place IDs on public program event location places', async () => {
    getProgramEventMock.mockResolvedValue({
      event: {
        id: 'event-1',
        title: 'Event',
        slug: 'event',
        contentJson: new Uint8Array(),
        typeId: 'type-1',
        timezone: 'Asia/Seoul',
        allDay: false,
        locationMode: ProgramEventLocationMode.MAP_PLACE,
        mapPlaceId: 'place-1',
        locationPlace: {
          id: 'place-1',
          name: 'Polarfront Lab',
          address: 'Seoul',
          lat: 37.539639,
          lng: 126.9904063,
          googlePlaceId: 'google-place-1',
        },
        artists: [],
        labels: [],
        clients: [],
        credits: [],
      },
    });

    await expect(getProgramEventView('event', { requestedLocale: 'ko' })).resolves.toMatchObject({
      locationPlace: {
        id: 'place-1',
        name: 'Polarfront Lab',
        googlePlaceId: 'google-place-1',
      },
    });
  });
});
