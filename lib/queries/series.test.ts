import { Code, ConnectError } from '@connectrpc/connect';
import { FilterOp, SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicSeriesClientWithAuth, createSeriesClient } from '@/lib/api/server-client';
import {
  getPublicSeries,
  getSeriesWithManagers,
  listMySeries,
  listPublicSeriesOptions,
  listSeriesAdmin,
} from './series';

const listSeriesAdminMock = vi.fn();
const listPublicSeriesMock = vi.fn();
const getPublicSeriesMock = vi.fn();
const listMySeriesMock = vi.fn();
const getSeriesWithManagersMock = vi.fn();

function managedSeries(index: number) {
  return {
    series: {
      id: `series-${index}`,
      title: `Series ${index}`,
      slug: `series-${index}`,
      sourceLocale: 'en',
      status: 'SERIES_STATUS_DRAFT',
    },
    postCount: index,
    managerCount: 1,
  };
}

function publicSeries(index: number) {
  return {
    id: `series-${index}`,
    title: `Series ${index}`,
    slug: `series-${index}`,
  };
}

vi.mock('@/lib/api/server-client', () => ({
  createPublicSeriesClientWithAuth: vi.fn(),
  createSeriesClient: vi.fn(),
}));

vi.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({ error: vi.fn() }),
}));

describe('listSeriesAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSeriesClient).mockResolvedValue({ listSeriesAdmin: listSeriesAdminMock } as never);
    listSeriesAdminMock.mockResolvedValue({ series: [], pagination: { total: 0 } });
  });

  it('forwards title search and status while dropping unsupported aggregate sorts', async () => {
    await listSeriesAdmin({
      page: 2,
      pageSize: 25,
      search: 'sessions',
      status: 'published',
      sort: [
        { field: 'postCount', order: 'desc' },
        { field: 'title', order: 'asc' },
      ],
    });

    expect(listSeriesAdminMock).toHaveBeenCalledWith({
      pagination: { limit: 25, offset: 25 },
      filters: [
        expect.objectContaining({ field: 'status', op: FilterOp.EQ, value: 'SERIES_STATUS_PUBLISHED' }),
        expect.objectContaining({ field: 'search', op: FilterOp.ILIKE, value: 'sessions' }),
      ],
      sorts: [{ field: 'title', order: SortOrder.ASC }],
    });
  });

  it('does not turn an invalid request into an empty result', async () => {
    const error = new ConnectError('invalid sort field', Code.InvalidArgument);
    listSeriesAdminMock.mockRejectedValue(error);

    await expect(listSeriesAdmin({ sort: [{ field: 'title', order: 'asc' }] })).rejects.toBe(error);
  });
});

describe('getSeriesWithManagers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSeriesClient).mockResolvedValue({ getSeriesWithManagers: getSeriesWithManagersMock } as never);
  });

  it('returns null only for an exact not-found result', async () => {
    getSeriesWithManagersMock.mockRejectedValueOnce(new ConnectError('missing', Code.NotFound));
    await expect(getSeriesWithManagers('series-1')).resolves.toBeNull();
  });

  it('rethrows operational failures', async () => {
    const error = new ConnectError('database unavailable', Code.Internal);
    getSeriesWithManagersMock.mockRejectedValueOnce(error);
    await expect(getSeriesWithManagers('series-1')).rejects.toBe(error);
  });
});

describe('public Series queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createPublicSeriesClientWithAuth).mockResolvedValue({
      list: listPublicSeriesMock,
      get: getPublicSeriesMock,
    } as never);
  });

  it('consumes the localized List title projection for selectors', async () => {
    listPublicSeriesMock.mockResolvedValue({
      series: [{ id: 'series-1', title: '한국어 시리즈', slug: 'field-notes' }],
    });

    await expect(listPublicSeriesOptions()).resolves.toEqual([
      { id: 'series-1', title: '한국어 시리즈', slug: 'field-notes' },
    ]);
    expect(listPublicSeriesMock).toHaveBeenCalledWith({
      pagination: { limit: 100, offset: 0 },
      sorts: [{ field: 'title', order: SortOrder.ASC }],
    });
  });

  it('loads every published Series page beyond 100 results and deduplicates rows', async () => {
    listPublicSeriesMock
      .mockResolvedValueOnce({
        series: Array.from({ length: 100 }, (_, index) => publicSeries(index + 1)),
        pagination: { total: 105, limit: 100, offset: 0, hasMore: true },
      })
      .mockResolvedValueOnce({
        series: [publicSeries(100), ...Array.from({ length: 5 }, (_, index) => publicSeries(index + 101))],
        pagination: { total: 105, limit: 100, offset: 100, hasMore: false },
      });

    const result = await listPublicSeriesOptions();

    expect(result).toHaveLength(105);
    expect(result[104]).toEqual(publicSeries(105));
    expect(listPublicSeriesMock).toHaveBeenNthCalledWith(1, {
      pagination: { limit: 100, offset: 0 },
      sorts: [{ field: 'title', order: SortOrder.ASC }],
    });
    expect(listPublicSeriesMock).toHaveBeenNthCalledWith(2, {
      pagination: { limit: 100, offset: 100 },
      sorts: [{ field: 'title', order: SortOrder.ASC }],
    });
  });

  it('rejects invalid public Series pagination instead of returning partial filters', async () => {
    listPublicSeriesMock.mockResolvedValueOnce({
      series: [],
      pagination: { total: 101, limit: 100, offset: 0, hasMore: true },
    });
    await expect(listPublicSeriesOptions()).rejects.toThrow(
      'List public Series returned an empty page with more results',
    );

    listPublicSeriesMock.mockResolvedValueOnce({
      series: [publicSeries(1)],
      pagination: { total: 101, limit: 100, offset: 1, hasMore: true },
    });
    await expect(listPublicSeriesOptions()).rejects.toThrow('List public Series pagination did not advance');

    listPublicSeriesMock.mockResolvedValueOnce({
      series: [publicSeries(1)],
      pagination: { total: 100, limit: 100, offset: 0, hasMore: true },
    });
    await expect(listPublicSeriesOptions()).rejects.toThrow(
      'List public Series pagination exceeded its declared total',
    );
  });

  it('uses SeriesService/Get with the requested locale and maps localized detail', async () => {
    getPublicSeriesMock.mockResolvedValue({
      series: {
        id: 'series-1',
        title: '현장 기록',
        slug: 'field-notes',
        description: '한국어 설명',
        postCount: 2,
        featuredImageAsset: { url: 'https://cdn.example.test/featured.webp' },
        ogAsset: { url: 'https://cdn.example.test/og.webp' },
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
      },
    });

    await expect(getPublicSeries('field%20notes', { requestedLocale: 'ko' })).resolves.toEqual({
      id: 'series-1',
      title: '현장 기록',
      slug: 'field-notes',
      description: '한국어 설명',
      postCount: 2,
      featuredImageUrl: 'https://cdn.example.test/featured.webp',
      ogImageUrl: 'https://cdn.example.test/og.webp',
      localizationInfo: expect.objectContaining({
        requestedLocale: 'ko',
        displayedLocale: 'ko',
        sourceLocale: 'en',
      }),
    });
    expect(createPublicSeriesClientWithAuth).toHaveBeenCalledWith('ko');
    expect(getPublicSeriesMock).toHaveBeenCalledWith({ slug: 'field notes' });
  });
});

describe('listMySeries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSeriesClient).mockResolvedValue({ listMySeries: listMySeriesMock } as never);
  });

  it('loads every managed Series page and deduplicates repeated rows', async () => {
    listMySeriesMock
      .mockResolvedValueOnce({
        series: [managedSeries(1), managedSeries(2), managedSeries(2)],
        pagination: { total: 3, limit: 2, offset: 0, hasMore: true },
      })
      .mockResolvedValueOnce({
        series: [managedSeries(2), managedSeries(3)],
        pagination: { total: 3, limit: 2, offset: 2, hasMore: false },
      });

    await expect(listMySeries()).resolves.toMatchObject([{ id: 'series-1' }, { id: 'series-2' }, { id: 'series-3' }]);
    expect(listMySeriesMock).toHaveBeenNthCalledWith(1, { pagination: { limit: 100, offset: 0 } });
    expect(listMySeriesMock).toHaveBeenNthCalledWith(2, { pagination: { limit: 100, offset: 2 } });
  });

  it('rejects a non-advancing page instead of looping forever', async () => {
    listMySeriesMock
      .mockResolvedValueOnce({
        series: [managedSeries(1)],
        pagination: { total: 2, limit: 1, offset: 0, hasMore: true },
      })
      .mockResolvedValueOnce({
        series: [managedSeries(2)],
        pagination: { total: 2, limit: 1, offset: 0, hasMore: true },
      });

    await expect(listMySeries()).rejects.toThrow('ListMySeries pagination did not advance');
  });

  it('rejects an empty page that claims more results', async () => {
    listMySeriesMock.mockResolvedValue({
      series: [],
      pagination: { total: 2, limit: 1, offset: 0, hasMore: true },
    });

    await expect(listMySeries()).rejects.toThrow('ListMySeries returned an empty page with more results');
  });

  it('rejects hasMore pagination that reaches or exceeds its declared total', async () => {
    listMySeriesMock.mockResolvedValue({
      series: [managedSeries(1)],
      pagination: { total: 1, limit: 1, offset: 0, hasMore: true },
    });

    await expect(listMySeries()).rejects.toThrow('ListMySeries pagination exceeded its declared total');
  });
});
