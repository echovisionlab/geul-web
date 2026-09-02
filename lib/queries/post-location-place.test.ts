import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicPostClientWithAuth } from '@/lib/api/server-client';
import { getPostView } from './post';

const getPostMock = vi.fn();

vi.mock('@/lib/api/server-client', () => ({
  createPublicPostClientWithAuth: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/utils/session.server', () => ({
  getMemberId: vi.fn(async () => null),
}));

vi.mock('@/lib/logging/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/queries/localized-public', () => ({
  mapPublicLocalizationInfo: vi.fn(() => null),
  maybeFetchSourceLocale: vi.fn(async ({ initialResponse }) => initialResponse),
}));

vi.mock('@/lib/queries/media-content-hydration', () => ({}));

beforeEach(() => {
  getPostMock.mockReset();
  vi.mocked(createPublicPostClientWithAuth).mockResolvedValue({
    get: getPostMock,
  } as unknown as Awaited<ReturnType<typeof createPublicPostClientWithAuth>>);
});

describe('getPostView location place mapping', () => {
  it('preserves Google place IDs on public post location places', async () => {
    getPostMock.mockResolvedValue({
      post: {
        id: 'post-1',
        title: 'Post',
        slug: 'post',
        summary: null,
        contentJson: new Uint8Array(),
        commentsEnabled: false,
        authors: [],
        categories: [],
        tags: [],
        mapPlaceId: 'place-1',
        locationPlace: {
          name: 'Polarfront Lab',
          lat: 37.539639,
          lng: 126.9904063,
          googlePlaceId: 'google-place-1',
        },
      },
    });

    await expect(getPostView('post', { requestedLocale: 'ko' })).resolves.toMatchObject({
      locationPlace: {
        name: 'Polarfront Lab',
        googlePlaceId: 'google-place-1',
      },
    });
  });
});
