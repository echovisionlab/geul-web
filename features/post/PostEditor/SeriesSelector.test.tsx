// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SeriesSelector } from './SeriesSelector';

const mocks = vi.hoisted(() => ({
  assign: vi.fn(),
  create: vi.fn(),
  listMySeries: vi.fn(),
  listSeriesPosts: vi.fn(),
  listSeriesSimple: vi.fn(),
  notification: vi.fn(),
  reorder: vi.fn(),
  unassign: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/components/core/Notification', () => ({
  notifications: { show: mocks.notification },
}));

vi.mock('@/lib/actions/series', () => ({
  assignPostToSeriesAction: mocks.assign,
  createSeriesAction: mocks.create,
  reorderSeriesPostsAction: mocks.reorder,
  unassignPostFromSeriesAction: mocks.unassign,
}));

vi.mock('@/lib/queries/series-browser', () => ({
  listMySeries: mocks.listMySeries,
  listSeriesPosts: mocks.listSeriesPosts,
  listSeriesSimple: mocks.listSeriesSimple,
}));

const oldSeries = { id: 'series-old', title: 'Old series', slug: 'old-series' };
const nextSeries = { id: 'series-next', title: 'Next series', slug: 'next-series' };

let container: HTMLDivElement;
let root: Root;

async function renderSelector(options: {
  available?: (typeof oldSeries)[];
  loadError?: Error;
  onPostPermissionRevoked?: () => void;
  initialOrder?: number;
  posts?: { id: string; title: string; slug: string; status: 'draft'; seriesOrder: number }[];
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  if (options.loadError) {
    mocks.listMySeries.mockRejectedValue(options.loadError);
    mocks.listSeriesSimple.mockRejectedValue(options.loadError);
  } else {
    mocks.listMySeries.mockResolvedValue(options.available ?? [oldSeries, nextSeries]);
    mocks.listSeriesSimple.mockResolvedValue(options.available ?? [oldSeries, nextSeries]);
  }
  mocks.listSeriesPosts.mockImplementation(async (seriesId: string) => {
    if (seriesId !== oldSeries.id) {
      return [];
    }
    return options.posts ?? [{ id: 'post-1', title: 'Post', slug: 'post', status: 'draft', seriesOrder: 0 }];
  });

  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <DesignSystemProvider forceColorScheme="light">
          <SeriesSelector
            postId="post-1"
            idPrefix="series"
            initialSeriesId={oldSeries.id}
            initialSeriesOrder={options.initialOrder ?? 0}
            canEdit
            isAdmin={false}
            series={[oldSeries, nextSeries]}
            onPostPermissionRevoked={options.onPostPermissionRevoked ?? vi.fn()}
          />
        </DesignSystemProvider>
      </QueryClientProvider>,
    );
  });
}

function seriesField() {
  const trigger = container.querySelector<HTMLInputElement>('#series-trigger');
  expect(trigger).not.toBeNull();
  return trigger!;
}

/** Core Select opens its listbox from the field's popup button; the field input is the named trigger. */
function openSeriesOptions() {
  const opener = seriesField()
    .closest('[data-geul-input]')
    ?.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]');
  expect(opener).toBeDefined();
  act(() => opener?.click());
}

async function selectNextSeries() {
  openSeriesOptions();
  await vi.waitFor(() => {
    const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
      (item) => item.textContent === nextSeries.title,
    );
    expect(option).toBeDefined();
  });
  const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
    (item) => item.textContent === nextSeries.title,
  );
  act(() => option?.click());
}

describe('SeriesSelector authority boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assign.mockResolvedValue({ success: true });
    mocks.create.mockResolvedValue({ data: { id: 'series-new' } });
    mocks.reorder.mockResolvedValue({ success: true });
    mocks.unassign.mockResolvedValue({ success: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('hides remove and reorder controls when a refreshed managed-Series list drops the current Series', async () => {
    await renderSelector({ available: [] });

    await vi.waitFor(() => expect(seriesField().placeholder).toBe('states.unavailable'));
    expect(seriesField().value).toBe('');
    expect(container.querySelector('[aria-label="remove"]')).toBeNull();
    expect(container.querySelector('[aria-label="Remove series"]')).toBeNull();
    expect(container.querySelector('[aria-label="Move series up"]')).toBeNull();
    expect(container.querySelector('[aria-label="Move series down"]')).toBeNull();
  });

  it('does not open stale options when the required fresh lookup fails', async () => {
    await renderSelector({ loadError: new Error('network down') });
    await vi.waitFor(() => expect(mocks.listMySeries).toHaveBeenCalled());

    openSeriesOptions();

    await vi.waitFor(() =>
      expect(mocks.notification).toHaveBeenCalledWith({ message: 'updateFailed', tone: 'danger' }),
    );
    expect(mocks.assign).not.toHaveBeenCalled();
    expect(mocks.listMySeries.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(document.querySelector('[role="option"]')).toBeNull();
    expect(container.querySelector('[aria-label="remove"]')).toBeNull();
  });

  it('renders a dense visible ordinal from the ordered result even if a stored order has a legacy gap', async () => {
    await renderSelector({
      initialOrder: 2,
      posts: [
        { id: 'post-other', title: 'Other', slug: 'other', status: 'draft', seriesOrder: 0 },
        { id: 'post-1', title: 'Post', slug: 'post', status: 'draft', seriesOrder: 2 },
      ],
    });

    await vi.waitFor(() => expect(container.textContent).toContain('2 / 2'));
    expect(container.textContent).toContain('#2');
    // Removal from the Series is the Core Select clear command, named for its effect.
    expect(container.querySelector('[aria-label="remove"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="moveUp"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="moveDown"]')).not.toBeNull();
  });

  it('restores the previous assignment and refreshes options when the target Series is unavailable', async () => {
    mocks.assign.mockResolvedValue({ error: 'series_unavailable' });
    const onPostPermissionRevoked = vi.fn();
    await renderSelector({ onPostPermissionRevoked });

    await selectNextSeries();

    await vi.waitFor(() => {
      expect(seriesField().value).toBe(oldSeries.title);
      expect(mocks.notification).toHaveBeenCalledWith({
        message: 'notifications.seriesUnavailable',
        tone: 'danger',
      });
    });
    expect(onPostPermissionRevoked).not.toHaveBeenCalled();
    expect(mocks.listMySeries.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('restores the previous assignment and opens the Post permission-revoked path without a Series toast', async () => {
    mocks.assign.mockResolvedValue({ error: 'post_permission_revoked' });
    const onPostPermissionRevoked = vi.fn();
    await renderSelector({ onPostPermissionRevoked });

    await selectNextSeries();

    await vi.waitFor(() => expect(onPostPermissionRevoked).toHaveBeenCalledOnce());
    expect(seriesField().value).toBe(oldSeries.title);
    expect(mocks.notification).not.toHaveBeenCalledWith({
      message: 'notifications.seriesUnavailable',
      tone: 'danger',
    });
  });
});
