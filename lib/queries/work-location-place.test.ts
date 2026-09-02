import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicWorkClientWithAuth } from '@/lib/api/server-client';
import { getWorkView } from './work';

const getWorkMock = vi.fn();

vi.mock('@/lib/api/server-client', () => ({
  createPublicWorkClientWithAuth: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/queries/localized-public', () => ({
  mapPublicLocalizationInfo: vi.fn(() => null),
  maybeFetchSourceLocale: vi.fn(async ({ initialResponse }) => initialResponse),
}));

vi.mock('@/lib/queries/media-content-hydration', () => ({}));

beforeEach(() => {
  getWorkMock.mockReset();
  vi.mocked(createPublicWorkClientWithAuth).mockResolvedValue({
    get: getWorkMock,
  } as unknown as Awaited<ReturnType<typeof createPublicWorkClientWithAuth>>);
});

describe('getWorkView location place mapping', () => {
  it('preserves Google place IDs on public work location places', async () => {
    getWorkMock.mockResolvedValue({
      work: {
        id: 'work-1',
        title: 'Work',
        slug: 'work',
        year: 2026,
        month: 5,
        isPresent: false,
        contentJson: new Uint8Array(),
        mapPlaceId: 'place-1',
        locationPlace: {
          name: 'Polarfront Lab',
          lat: 37.539639,
          lng: 126.9904063,
          googlePlaceId: 'google-place-1',
        },
        credits: [],
        clients: [],
        labels: [],
        tags: [],
      },
    });

    await expect(getWorkView('work', { requestedLocale: 'ko' })).resolves.toMatchObject({
      locationPlace: {
        name: 'Polarfront Lab',
        googlePlaceId: 'google-place-1',
      },
    });
  });
});
