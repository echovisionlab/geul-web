// @vitest-environment jsdom

import { render, screen, userEvent, act, waitFor } from '@/test/render';
import en from '@/messages/en.json';
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

let queryClient: QueryClient;

async function renderSelector(options: {
  available?: (typeof oldSeries)[];
  loadError?: Error;
  onPostPermissionRevoked?: () => void;
  initialOrder?: number;
  posts?: { id: string; title: string; slug: string; status: 'draft'; seriesOrder: number }[];
}) {
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

  return render(
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>,
  );
}
function seriesField() {
  return screen.getByRole('combobox', { name: en.common.entities.series }) as HTMLInputElement;
}
async function openSeriesOptions() {
  await userEvent.click(screen.getByRole('button', { expanded: false }));
}
async function selectNextSeries() {
  await openSeriesOptions();
  await userEvent.click(await screen.findByRole('option', { name: nextSeries.title }));
}

describe('SeriesSelector authority boundary', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.clearAllMocks();
    mocks.assign.mockResolvedValue({ success: true });
    mocks.create.mockResolvedValue({ data: { id: 'series-new' } });
    mocks.reorder.mockResolvedValue({ success: true });
    mocks.unassign.mockResolvedValue({ success: true });
  });

  afterEach(async () => {
    await act(async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
    });
  });

  it('hides remove and reorder controls when a refreshed managed-Series list drops the current Series', async () => {
    await renderSelector({ available: [] });

    await waitFor(() => expect(seriesField().placeholder).toBe(en.postEditor.seriesSelector.states.unavailable));
    expect(seriesField().value).toBe('');
    expect(screen.queryByRole('button', { name: en.seriesDetail.posts.actions.remove })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove series' })).toBeNull();
    expect(screen.queryByRole('button', { name: en.seriesDetail.posts.actions.moveUp })).toBeNull();
    expect(screen.queryByRole('button', { name: en.seriesDetail.posts.actions.moveDown })).toBeNull();
  });

  it('does not open stale options when the required fresh lookup fails', async () => {
    await renderSelector({ loadError: new Error('network down') });
    await waitFor(() => expect(mocks.listMySeries).toHaveBeenCalled());

    await openSeriesOptions();

    await waitFor(() =>
      expect(mocks.notification).toHaveBeenCalledWith({
        message: en.common.notifications.updateFailed,
        tone: 'danger',
      }),
    );
    expect(mocks.assign).not.toHaveBeenCalled();
    expect(mocks.listMySeries.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('option')).toBeNull();
    expect(screen.queryByRole('button', { name: en.seriesDetail.posts.actions.remove })).toBeNull();
  });

  it('renders a dense visible ordinal from the ordered result even if a stored order has a legacy gap', async () => {
    await renderSelector({
      initialOrder: 2,
      posts: [
        { id: 'post-other', title: 'Other', slug: 'other', status: 'draft', seriesOrder: 0 },
        { id: 'post-1', title: 'Post', slug: 'post', status: 'draft', seriesOrder: 2 },
      ],
    });

    expect(await screen.findByText('2 / 2')).toBeVisible();
    expect(screen.getByText('#2')).toBeVisible();
    // Removal from the Series is the Core Select clear command, named for its effect.
    expect(screen.getByRole('button', { name: en.seriesDetail.posts.actions.remove })).not.toBeNull();
    expect(screen.getByRole('button', { name: en.seriesDetail.posts.actions.moveUp })).not.toBeNull();
    expect(screen.getByRole('button', { name: en.seriesDetail.posts.actions.moveDown })).not.toBeNull();
  });

  it('restores the previous assignment and refreshes options when the target Series is unavailable', async () => {
    mocks.assign.mockResolvedValue({ error: 'series_unavailable' });
    const onPostPermissionRevoked = vi.fn();
    await renderSelector({ onPostPermissionRevoked });

    await selectNextSeries();

    await waitFor(() => {
      expect(seriesField().value).toBe(oldSeries.title);
      expect(mocks.notification).toHaveBeenCalledWith({
        message: en.postEditor.seriesSelector.notifications.seriesUnavailable,
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

    await waitFor(() => expect(onPostPermissionRevoked).toHaveBeenCalledOnce());
    expect(seriesField().value).toBe(oldSeries.title);
    expect(mocks.notification).not.toHaveBeenCalledWith({
      message: en.postEditor.seriesSelector.notifications.seriesUnavailable,
      tone: 'danger',
    });
  });
});
