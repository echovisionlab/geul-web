// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listEvents: vi.fn(),
  listTypes: vi.fn(),
}));

vi.mock('@/lib/queries/program-event-browser', () => ({
  listProgramEventsForBlockBrowser: mocks.listEvents,
  listProgramEventTypeOptionsBrowser: mocks.listTypes,
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/features/program-event/EventSeriesEventsTableView', () => ({
  EventSeriesEventsTableView: ({
    result,
    onQueryChange,
    onLoadMore,
  }: {
    result: { data: Array<{ id: string }> };
    onQueryChange: (query: { page: number; pageSize: number; search: string }) => void;
    onLoadMore: () => void;
  }) => (
    <div>
      <output data-testid="event-ids">{result.data.map((event) => event.id).join(',')}</output>
      <button type="button" onClick={() => onQueryChange({ page: 1, pageSize: 1, search: 'new' })}>
        search new
      </button>
      <button type="button" onClick={onLoadMore}>
        load more
      </button>
    </div>
  ),
}));

import { EventSeriesEventsTable } from './EventSeriesEventsTable';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function event(id: string) {
  return {
    id,
    href: `/events/${id}`,
    title: id,
    summary: null,
    typeName: null,
    startsAt: null,
    endsAt: null,
    timezone: null,
    allDay: false,
    locationMode: 'tba',
    imageUrl: null,
    publishedAt: null,
  };
}

function response(ids: string[], total = 2) {
  return {
    events: ids.map(event),
    pagination: { total, limit: 1, offset: 0 },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

function render() {
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <EventSeriesEventsTable
          seriesId="series-1"
          initialEvents={[event('initial-1')] as never}
          initialPagination={{ total: 2, limit: 1, offset: 0, hasMore: true }}
          pageSize={1}
        />
      </QueryClientProvider>,
    );
  });
}

beforeEach(() => {
  mocks.listEvents.mockReset();
  mocks.listTypes.mockReset().mockResolvedValue([]);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
});

afterEach(() => {
  act(() => root.unmount());
  queryClient.clear();
  container.remove();
});

describe('EventSeriesEventsTable pagination', () => {
  it('ignores a load-more response after the active query changes', async () => {
    const oldLoadMore = deferred<ReturnType<typeof response>>();
    const newSearch = deferred<ReturnType<typeof response>>();
    mocks.listEvents.mockImplementation((input: { offset: number; search?: string }) => {
      if (input.offset === 1) {
        return oldLoadMore.promise;
      }
      if (input.search === 'new') {
        return newSearch.promise;
      }
      return Promise.resolve(response(['initial-1']));
    });

    render();
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      container.querySelectorAll('button')[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.listEvents).toHaveBeenCalledWith(expect.objectContaining({ offset: 1 }));

    act(() => {
      container.querySelectorAll('button')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.listEvents).toHaveBeenCalledWith(expect.objectContaining({ search: 'new', offset: 0 }));
    await act(async () => {
      newSearch.resolve(response(['new-1']));
    });
    await vi.waitFor(async () => {
      await act(async () => {
        await Promise.resolve();
      });
      expect(container.querySelector('[data-testid="event-ids"]')?.textContent).toBe('new-1');
    });

    await act(async () => {
      oldLoadMore.resolve(response(['old-2']));
      await oldLoadMore.promise;
    });
    expect(container.querySelector('[data-testid="event-ids"]')?.textContent).toBe('new-1');
  });
});
