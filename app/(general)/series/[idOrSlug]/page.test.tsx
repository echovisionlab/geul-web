import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listPublishedPosts } from '@/lib/queries/post';
import { getPublicSeries } from '@/lib/queries/series';
import SeriesPage from './page';

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('not found');
  }),
  renderPageRouteFallback: vi.fn(),
}));

vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock('@/lib/queries/post', () => ({ listPublishedPosts: vi.fn() }));
vi.mock('@/lib/queries/series', () => ({ getPublicSeries: vi.fn() }));
vi.mock('@/lib/queries/metadata', () => ({ getSiteMetadataDocument: vi.fn() }));
vi.mock('@/lib/utils/header.server', () => ({ getRequestHeaders: vi.fn() }));
vi.mock('@/lib/utils/language.server', () => ({ getUserLocale: vi.fn(async () => 'ko') }));
vi.mock('@/lib/utils/url.server', () => ({ getBaseUrl: vi.fn(async () => 'https://studio.example.test') }));
vi.mock('@/app/_shared/page-route-fallback', () => ({
  generatePageRouteFallbackMetadata: vi.fn(),
  renderPageRouteFallback: mocks.renderPageRouteFallback,
}));

describe('public Post Series route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPublicSeries).mockResolvedValue({
      id: 'series-1',
      title: '현장 기록',
      slug: 'field-notes',
      description: '시리즈 설명',
      postCount: 12,
      featuredImageUrl: null,
      ogImageUrl: null,
      localizationInfo: {
        requestedLocale: 'ko',
        displayedLocale: 'ko',
        sourceLocale: 'en',
        isFallback: false,
        isOriginal: false,
        machineGenerated: false,
        fallbackReason: 0,
        availableLocales: ['en', 'ko'],
      },
    });
    vi.mocked(listPublishedPosts).mockResolvedValue({
      posts: [],
      pagination: { total: 12, limit: 10, offset: 10, hasMore: false },
    });
    mocks.renderPageRouteFallback.mockReturnValue(<div>page-fallback</div>);
  });

  it('uses localized SeriesService/Get and paginates public Posts in Series order', async () => {
    const page = await SeriesPage({
      params: Promise.resolve({ idOrSlug: 'field-notes' }),
      searchParams: Promise.resolve({
        lang: 'ko',
        seriesPosts: JSON.stringify({ page: 2 }),
      }),
    });

    expect(page).toBeTruthy();
    expect(getPublicSeries).toHaveBeenCalledWith('field-notes', { requestedLocale: 'ko' });
    expect(listPublishedPosts).toHaveBeenCalledWith({
      seriesId: 'series-1',
      sortBy: 'series_order',
      sortOrder: 'asc',
      limit: 10,
      offset: 10,
      requestedLocale: 'ko',
    });
  });

  it('falls back to the nested Page route when public Get hides a missing or draft Series', async () => {
    vi.mocked(getPublicSeries).mockResolvedValueOnce(null);

    const page = await SeriesPage({
      params: Promise.resolve({ idOrSlug: 'draft-series' }),
      searchParams: Promise.resolve({}),
    });
    expect(page).toBeTruthy();
    expect(mocks.renderPageRouteFallback).toHaveBeenCalledWith(['series', 'draft-series'], {});
    expect(listPublishedPosts).not.toHaveBeenCalled();
  });
});
