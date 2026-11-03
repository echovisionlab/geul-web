// @vitest-environment jsdom

import { Activity } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@/test/render';
import { EventSeriesEventsTable } from './EventSeriesEventsTable';

const mocks = vi.hoisted(() => ({
  listEvents: vi.fn(),
  listTypes: vi.fn(),
}));

vi.mock('@/lib/queries/program-event-browser', () => ({
  listProgramEventsForBlockBrowser: mocks.listEvents,
  listProgramEventTypeOptionsBrowser: mocks.listTypes,
}));

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
    locationMode: 'tba' as const,
    imageUrl: null,
    posterUrl: null,
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
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

let queryClient: QueryClient;

function table({ seriesId = 'series-1', visible = true } = {}) {
  return (
    <QueryClientProvider client={queryClient}>
      <Activity mode={visible ? 'visible' : 'hidden'}>
        <EventSeriesEventsTable
          seriesId={seriesId}
          initialTypeOptions={[]}
          initialEvents={[event('initial-1')]}
          initialPagination={{ total: 2, limit: 1, offset: 0, hasMore: true }}
          pageSize={1}
        />
      </Activity>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mocks.listEvents.mockReset();
  mocks.listTypes.mockReset().mockResolvedValue([]);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  });
});

afterEach(() => {
  queryClient.clear();
  vi.useRealTimers();
});

describe('EventSeriesEventsTable requests', () => {
  it('ignores a load-more response after the active query changes', async () => {
    const oldLoadMore = deferred<ReturnType<typeof response>>();
    const newSearch = deferred<ReturnType<typeof response>>();
    mocks.listEvents.mockImplementation((input: { offset: number; search?: string }) =>
      input.offset === 1 ? oldLoadMore.promise : newSearch.promise,
    );

    const { user } = render(table());
    await user.click(screen.getByRole('button', { name: 'Show 1 more' }));
    await vi.dynamicImportSettled();
    expect(mocks.listEvents).toHaveBeenCalledWith(expect.objectContaining({ offset: 1 }));

    vi.useFakeTimers();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search...' }), { target: { value: 'new' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(mocks.listEvents).toHaveBeenCalledWith(expect.objectContaining({ search: 'new', offset: 0 }));
    await act(async () => {
      newSearch.resolve(response(['new-1']));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(within(screen.getByRole('table')).getByRole('link', { name: 'new-1' })).toBeVisible();

    await act(async () => {
      oldLoadMore.resolve(response(['old-2']));
    });
    expect(within(screen.getByRole('table')).getByRole('link', { name: 'new-1' })).toBeVisible();
    expect(screen.queryAllByRole('link', { name: 'old-2' })).toHaveLength(0);
  });

  it('keeps existing rows visible and disables load more while the main query fetches or fails until retry succeeds', async () => {
    const pending = deferred<ReturnType<typeof response>>();
    mocks.listEvents.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response(['recovered-1']));
    const { user } = render(table());

    act(() => {
      void queryClient.invalidateQueries({ queryKey: ['program-event-series-events'] });
    });
    const loadMore = screen.getByRole('button', { name: 'Show 1 more' });
    await waitFor(() => expect(loadMore).toBeDisabled());
    expect(within(screen.getByRole('table')).getByRole('link', { name: 'initial-1' })).toBeVisible();

    await act(async () => {
      pending.reject(new Error('Offline'));
    });
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(within(screen.getByRole('table')).getByRole('link', { name: 'initial-1' })).toBeVisible();
    expect(loadMore).toBeDisabled();

    await user.click(loadMore);
    expect(mocks.listEvents).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect((await screen.findAllByRole('link', { name: 'recovered-1' }))[0]).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(loadMore).toBeEnabled();
  });

  it('shows load-more failure without losing rows and allows retry', async () => {
    mocks.listEvents
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(response(['initial-1', 'next-2']));
    const { user } = render(table());

    await user.click(screen.getByRole('button', { name: 'Show 1 more' }));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeVisible();
    expect(within(screen.getByRole('table')).getByRole('link', { name: 'initial-1' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Show 1 more' }));
    expect((await screen.findAllByRole('link', { name: 'next-2' }))[0]).toBeVisible();
    expect(within(screen.getByRole('table')).getAllByRole('link', { name: 'initial-1' })).toHaveLength(1);
    expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
  });

  it('discards load-more results after its effects disconnect', async () => {
    const pending = deferred<ReturnType<typeof response>>();
    mocks.listEvents.mockReturnValueOnce(pending.promise);
    const { user, rerender } = render(table());

    await user.click(screen.getByRole('button', { name: 'Show 1 more' }));
    await vi.dynamicImportSettled();
    expect(mocks.listEvents).toHaveBeenCalledWith(expect.objectContaining({ offset: 1 }));

    rerender(table({ visible: false }));
    rerender(table());
    await act(async () => {
      pending.resolve(response(['stale-2']));
    });

    expect(within(screen.getByRole('table')).getByRole('link', { name: 'initial-1' })).toBeVisible();
    expect(screen.queryAllByRole('link', { name: 'stale-2' })).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Show 1 more' })).toBeEnabled();
  });

  it('clears the previous context pending state without letting its completion unlock a new request', async () => {
    const oldRequest = deferred<ReturnType<typeof response>>();
    const currentRequest = deferred<ReturnType<typeof response>>();
    mocks.listEvents.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(currentRequest.promise);
    const { user, rerender } = render(table());

    await user.click(screen.getByRole('button', { name: 'Show 1 more' }));
    await vi.dynamicImportSettled();
    rerender(table({ seriesId: 'series-2' }));
    const loadMore = screen.getByRole('button', { name: 'Show 1 more' });
    expect(loadMore).toBeEnabled();
    await user.click(loadMore);
    await vi.dynamicImportSettled();

    await act(async () => {
      oldRequest.reject(new Error('Old series failed'));
    });
    expect(loadMore).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();

    await act(async () => {
      currentRequest.resolve(response(['current-2']));
    });
    expect((await screen.findAllByRole('link', { name: 'current-2' }))[0]).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Show 1 more' })).not.toBeInTheDocument();
  });
});
