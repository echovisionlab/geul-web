import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeriesClient } from '@/lib/api/browser-client';
import { listMySeries, listSeriesManagers } from './series-browser';

const listMySeriesMock = vi.fn();
const listSeriesManagersMock = vi.fn();

vi.mock('@/lib/api/browser-client', () => ({ createSeriesClient: vi.fn() }));
vi.mock('@/lib/queries/user-browser', () => ({ searchMembers: vi.fn() }));
vi.mock('@/lib/utils/client-logger', () => ({
  createClientLogger: () => ({ error: vi.fn() }),
}));

function managedSeries(index: number) {
  return {
    series: {
      id: `series-${index}`,
      title: `Series ${index}`,
      slug: `series-${index}`,
      status: 'SERIES_STATUS_DRAFT',
    },
    postCount: index,
    managerCount: 1,
  };
}

describe('listMySeries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSeriesClient).mockReturnValue({ listMySeries: listMySeriesMock } as never);
  });

  it('loads every managed Series page beyond the first 20 results', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => managedSeries(index + 1));
    const secondPage = Array.from({ length: 5 }, (_, index) => managedSeries(index + 21));
    listMySeriesMock
      .mockResolvedValueOnce({
        series: firstPage,
        pagination: { total: 25, limit: 20, offset: 0, hasMore: true },
      })
      .mockResolvedValueOnce({
        series: secondPage,
        pagination: { total: 25, limit: 20, offset: 20, hasMore: false },
      });

    const result = await listMySeries();

    expect(result).toHaveLength(25);
    expect(result[24]).toMatchObject({ id: 'series-25', title: 'Series 25' });
    expect(listMySeriesMock).toHaveBeenNthCalledWith(1, { pagination: { limit: 100, offset: 0 } });
    expect(listMySeriesMock).toHaveBeenNthCalledWith(2, { pagination: { limit: 100, offset: 20 } });
  });

  it('deduplicates a Series repeated across pages', async () => {
    listMySeriesMock
      .mockResolvedValueOnce({
        series: [managedSeries(1), managedSeries(1)],
        pagination: { total: 2, limit: 1, offset: 0, hasMore: true },
      })
      .mockResolvedValueOnce({
        series: [managedSeries(1), managedSeries(2)],
        pagination: { total: 2, limit: 1, offset: 1, hasMore: false },
      });

    await expect(listMySeries()).resolves.toMatchObject([{ id: 'series-1' }, { id: 'series-2' }]);
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
    expect(listMySeriesMock).toHaveBeenCalledOnce();
  });

  it('rejects hasMore pagination that advances beyond its declared total', async () => {
    listMySeriesMock.mockResolvedValue({
      series: [managedSeries(1)],
      pagination: { total: 1, limit: 1, offset: 0, hasMore: true },
    });

    await expect(listMySeries()).rejects.toThrow('ListMySeries pagination exceeded its declared total');
    expect(listMySeriesMock).toHaveBeenCalledOnce();
  });
});

describe('listSeriesManagers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSeriesClient).mockReturnValue({ listSeriesManagers: listSeriesManagersMock } as never);
  });

  it('propagates lookup failures instead of presenting them as an empty manager list', async () => {
    const failure = new Error('manager lookup failed');
    listSeriesManagersMock.mockRejectedValue(failure);

    await expect(listSeriesManagers('series-1')).rejects.toBe(failure);
  });
});
