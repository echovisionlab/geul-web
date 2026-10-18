// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VersionInfo, VersionListResult } from '@/lib/types/version-history';
import { useVersionHistoryQuery } from './useVersionHistoryQuery';

type QueryProps = Parameters<typeof useVersionHistoryQuery>[0];
type QueryResult = ReturnType<typeof useVersionHistoryQuery>;

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;
let current: QueryResult;

function Query(props: QueryProps) {
  current = useVersionHistoryQuery(props);
  return null;
}

async function renderQuery(props: Partial<QueryProps> = {}) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Query entityType="work" entityId="work-1" opened {...props} />
      </QueryClientProvider>,
    ),
  );
}

async function waitFor(assertion: () => void) {
  await act(async () => vi.waitFor(assertion));
}

function versions(start: number, count: number): VersionInfo[] {
  return Array.from({ length: count }, (_, offset) => {
    const version = start + offset;
    return {
      id: `version-${version}`,
      version,
      title: `Version ${version}`,
      sourceLocale: 'en',
      contributors: [],
      createdAt: '2026-10-12T00:00:00.000Z',
    };
  });
}

function response(result: VersionListResult, status = 200) {
  return new Response(JSON.stringify(result), { status });
}

function requestedPages(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map(([input]) =>
    Number(new URL(String(input), 'http://localhost').searchParams.get('page')),
  );
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  vi.unstubAllGlobals();
});

describe('useVersionHistoryQuery', () => {
  it('waits until opened, requests numeric consecutive pages and ends at the latest total', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ versions: versions(1, 20), total: 45 }))
      .mockResolvedValueOnce(response({ versions: versions(21, 20), total: 45 }))
      .mockResolvedValueOnce(response({ versions: versions(41, 5), total: 45 }));
    vi.stubGlobal('fetch', fetchMock);

    await renderQuery({ opened: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(current.versions).toEqual([]);
    expect(current.nextPage).toBeNull();
    await renderQuery();
    await waitFor(() => expect(current.versions).toHaveLength(20));
    expect(current.nextPage).toBe(2);
    expect(current.hasNextPage).toBe(true);
    await act(async () => {
      await current.fetchNextPage();
    });
    await waitFor(() => expect(current.versions).toHaveLength(40));
    expect(current.nextPage).toBe(3);
    await act(async () => {
      await current.fetchNextPage();
    });
    await waitFor(() => expect(current.versions).toHaveLength(45));
    expect(current.nextPage).toBeNull();
    expect(current.hasNextPage).toBe(false);
    expect(current.data?.pageParams).toEqual([1, 2, 3]);
    expect(requestedPages(fetchMock)).toEqual([1, 2, 3]);
    expect(
      fetchMock.mock.calls.every(
        ([input, init]) =>
          new URL(String(input), 'http://localhost').searchParams.get('pageSize') === '20' &&
          init.signal instanceof AbortSignal,
      ),
    ).toBe(true);
    await act(async () => {
      await current.fetchNextPage();
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('uses the latest total and requested offsets rather than deduplicated row count', async () => {
    const firstPage = versions(1, 20);
    const overlapping = versions(20, 20);
    overlapping[0] = { ...overlapping[0], title: 'Changed duplicate' };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ versions: firstPage, total: 80 }))
      .mockResolvedValueOnce(response({ versions: overlapping, total: 40 }));
    vi.stubGlobal('fetch', fetchMock);

    await renderQuery();
    await waitFor(() => expect(current.versions).toHaveLength(20));
    const alreadyLoaded = current.versions.at(-1);
    await act(async () => {
      await current.fetchNextPage();
    });
    await waitFor(() => expect(current.versions).toHaveLength(39));

    expect(current.versions[19]).toBe(alreadyLoaded);
    expect(current.versions[19].title).toBe('Version 20');
    expect(current.nextPage).toBeNull();
    expect(current.hasNextPage).toBe(false);
    expect(requestedPages(fetchMock)).toEqual([1, 2]);
  });

  it('treats an available total as authoritative even when a page is shorter than twenty', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ versions: versions(1, 5), total: 25 }))
      .mockResolvedValueOnce(response({ versions: versions(21, 5), total: 25 }));
    vi.stubGlobal('fetch', fetchMock);

    await renderQuery();
    await waitFor(() => expect(current.versions).toHaveLength(5));
    expect(current.nextPage).toBe(2);
    await act(async () => {
      await current.fetchNextPage();
    });
    await waitFor(() => expect(current.versions).toHaveLength(10));
    expect(current.nextPage).toBeNull();
  });

  it('continues a full page without a total and stops at a short page', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ versions: versions(1, 20) }))
      .mockResolvedValueOnce(response({ versions: versions(21, 1) }));
    vi.stubGlobal('fetch', fetchMock);

    await renderQuery();
    await waitFor(() => expect(current.versions).toHaveLength(20));
    expect(current.nextPage).toBe(2);
    await act(async () => {
      await current.fetchNextPage();
    });
    await waitFor(() => expect(current.versions).toHaveLength(21));
    expect(current.nextPage).toBeNull();
  });

  it('stops at an empty result even if its total suggests another page', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ versions: versions(1, 20), total: 100 }))
      .mockResolvedValueOnce(response({ versions: [], total: 100 }));
    vi.stubGlobal('fetch', fetchMock);

    await renderQuery();
    await waitFor(() => expect(current.versions).toHaveLength(20));
    await act(async () => {
      await current.fetchNextPage();
    });
    await waitFor(() => expect(current.data?.pages).toHaveLength(2));
    expect(current.versions).toHaveLength(20);
    expect(current.nextPage).toBeNull();
    expect(current.hasNextPage).toBe(false);
  });

  it('loads histories beyond one hundred versions without an overall count cap', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const page = Number(new URL(String(input), 'http://localhost').searchParams.get('page'));
      return response({ versions: versions((page - 1) * 20 + 1, page === 6 ? 1 : 20), total: 101 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await renderQuery();
    await waitFor(() => expect(current.versions).toHaveLength(20));
    for (let page = 2; page <= 6; page += 1) {
      await act(async () => {
        await current.fetchNextPage();
      });
      await waitFor(() => expect(current.versions).toHaveLength(Math.min(page * 20, 101)));
    }
    expect(current.versions.at(-1)?.id).toBe('version-101');
    expect(current.nextPage).toBeNull();
    expect(requestedPages(fetchMock)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('reuses an in-flight next-page request when requested twice and keeps loaded rows stable', async () => {
    let finish!: (value: Response) => void;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ versions: versions(1, 20), total: 40 }))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await renderQuery();
    await waitFor(() => expect(current.versions).toHaveLength(20));
    const loaded = current.versions;
    let first!: ReturnType<QueryResult['fetchNextPage']>;
    let second!: ReturnType<QueryResult['fetchNextPage']>;
    await act(async () => {
      first = current.fetchNextPage();
      second = current.fetchNextPage();
    });
    await waitFor(() => expect(current.isFetchingNextPage).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(current.versions).toBe(loaded);
    await act(async () => {
      finish(response({ versions: versions(21, 20), total: 40 }));
      await Promise.all([first, second]);
    });
    await waitFor(() => expect(current.versions).toHaveLength(40));
    expect(current.isFetchingNextPage).toBe(false);
    expect(requestedPages(fetchMock)).toEqual([1, 2]);
  });

  it('keeps rows after a next-page error and retries that page only when explicitly requested', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ versions: versions(1, 20), total: 40 }))
      .mockResolvedValueOnce(response({ error: 'Temporarily unavailable' }, 503))
      .mockResolvedValueOnce(response({ versions: versions(21, 20), total: 40 }));
    vi.stubGlobal('fetch', fetchMock);

    await renderQuery();
    await waitFor(() => expect(current.versions).toHaveLength(20));
    const loaded = current.versions;
    await act(async () => {
      await current.fetchNextPage();
    });
    await waitFor(() => expect(current.isFetchNextPageError).toBe(true));
    expect(current.error?.message).toBe('Temporarily unavailable');
    expect(current.versions).toBe(loaded);
    expect(current.nextPage).toBe(2);
    expect(current.isFetchingNextPage).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      await current.fetchNextPage();
    });
    await waitFor(() => expect(current.versions).toHaveLength(40));
    expect(current.isFetchNextPageError).toBe(false);
    expect(current.error).toBeNull();
    expect(current.nextPage).toBeNull();
    expect(requestedPages(fetchMock)).toEqual([1, 2, 2]);
  });

  it('reports an initial service error and allows refetching page one', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ error: 'Forbidden' }, 403))
      .mockResolvedValueOnce(response({ versions: versions(1, 1), total: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    await renderQuery();
    await waitFor(() => expect(current.isError).toBe(true));
    expect(current.error?.message).toBe('Forbidden');
    expect(current.versions).toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
    await act(async () => {
      await current.refetch();
    });
    await waitFor(() => expect(current.versions).toHaveLength(1));
    expect(current.error).toBeNull();
    expect(requestedPages(fetchMock)).toEqual([1, 1]);
  });

  it('isolates caches by entity type and ID and aborts an unmounted active request', async () => {
    let pendingSignal: AbortSignal | undefined;
    // The Page response waits for the test, so the empty state before it is observable on any machine.
    let releasePage!: () => void;
    const pageReleased = new Promise<void>((resolve) => (releasePage = resolve));
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const path = new URL(String(input), 'http://localhost').pathname;
      if (path === '/api/version-history/page/same') {
        await pageReleased;
      }
      if (path.endsWith('/pending')) {
        pendingSignal = init?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          pendingSignal?.addEventListener('abort', () => reject(pendingSignal?.reason), { once: true });
        });
      }
      return response({ versions: [{ ...versions(1, 1)[0], id: path }], total: 1 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await renderQuery({ entityType: 'work', entityId: 'same' });
    await waitFor(() => expect(current.versions[0]?.id).toBe('/api/version-history/work/same'));
    await renderQuery({ entityType: 'page', entityId: 'same' });
    expect(current.versions).toEqual([]);
    releasePage();
    await waitFor(() => expect(current.versions[0]?.id).toBe('/api/version-history/page/same'));
    await renderQuery({ entityType: 'work', entityId: 'other' });
    await waitFor(() => expect(current.versions[0]?.id).toBe('/api/version-history/work/other'));
    expect(client.getQueryData(['version-history', 'work', 'same'])).toBeDefined();
    expect(client.getQueryData(['version-history', 'page', 'same'])).toBeDefined();
    expect(client.getQueryData(['version-history', 'work', 'other'])).toBeDefined();
    await renderQuery({ entityId: 'pending' });
    await waitFor(() => expect(current.isLoading).toBe(true));
    expect(pendingSignal?.aborted).toBe(false);
    await act(async () => root.render(null));
    expect(pendingSignal?.aborted).toBe(true);
  });
});
