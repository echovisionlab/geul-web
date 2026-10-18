// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationRegion, notifications } from '@/components/core/Notification';
import type { ReleaseArtistItem } from '@/lib/types/release/model';
import { act, render, screen, waitFor, within } from '@/test/render';
import { ReleaseArtistsSection } from './ReleaseArtistsSection';

const actions = vi.hoisted(() => ({
  listArtistsAction: vi.fn(),
  setReleaseArtistsAction: vi.fn(),
}));

vi.mock('@/lib/actions/artist', () => ({ listArtistsAction: actions.listArtistsAction }));
vi.mock('@/lib/actions/release', () => ({ setReleaseArtistsAction: actions.setReleaseArtistsAction }));

afterEach(() => {
  act(() => notifications.clean());
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('ReleaseArtistsSection', () => {
  it('adds a release artist and persists normalized sort order', async () => {
    actions.listArtistsAction.mockResolvedValue({
      ok: true,
      value: [
        { id: 'artist-1', name: 'Artist One', slug: 'artist-one', imageUrl: null },
        { id: 'artist-2', name: 'Artist Two', slug: 'artist-two', imageUrl: null },
      ],
    });
    actions.setReleaseArtistsAction.mockResolvedValue({ ok: true, success: true });
    const onArtistsChange = vi.fn();
    const onMutationSettled = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

    const { user } = render(
      <QueryClientProvider client={client}>
        <ReleaseArtistsSection
          releaseId="release-1"
          artists={[{ artist_id: 'artist-2', artist_name: 'Artist Two', artist_slug: 'artist-two', sort_order: 9 }]}
          onArtistsChange={onArtistsChange}
          onMutationStart={() => 'test-editor-origin'}
          onMutationSettled={onMutationSettled}
        />
        <NotificationRegion closeLabel="Close" />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Add Artist' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add artist' });
    await user.type(within(dialog).getByRole('combobox', { name: 'Artist' }), 'One');
    await user.click(await screen.findByRole('option', { name: 'Artist One' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(onArtistsChange).toHaveBeenCalledWith([
      { artist_id: 'artist-2', artist_name: 'Artist Two', artist_slug: 'artist-two', sort_order: 0 },
      {
        artist_id: 'artist-1',
        artist_name: 'Artist One',
        artist_slug: 'artist-one',
        sort_order: 1,
      },
    ] satisfies ReleaseArtistItem[]);
    expect(actions.setReleaseArtistsAction).toHaveBeenCalledWith(
      'release-1',
      [
        { artistId: 'artist-2', sortOrder: 0 },
        { artistId: 'artist-1', sortOrder: 1 },
      ],
      [{ artistId: 'artist-2', sortOrder: 0 }],
      undefined,
      'test-editor-origin',
    );
    await waitFor(() => expect(onMutationSettled).toHaveBeenCalledWith(true));
    expect(await screen.findByText('Artists updated')).toBeInTheDocument();
  });

  it('persists a keyboard reorder with normalized order, observed order and neighbour intent', async () => {
    actions.listArtistsAction.mockResolvedValue({ ok: true, value: [] });
    actions.setReleaseArtistsAction.mockResolvedValue({ success: true });
    const artists: ReleaseArtistItem[] = [
      { artist_id: 'artist-1', artist_name: 'Artist One', artist_slug: 'artist-one', sort_order: 7 },
      { artist_id: 'artist-2', artist_name: 'Artist Two', artist_slug: 'artist-two', sort_order: 12 },
    ];
    const onArtistsChange = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { user, unmount } = render(
      <QueryClientProvider client={client}>
        <ReleaseArtistsSection
          releaseId="release-1"
          artists={artists}
          onArtistsChange={onArtistsChange}
          onMutationStart={() => 'reorder-editor-origin'}
        />
      </QueryClientProvider>,
    );
    try {
      // jsdom has no layout; provide the two browser measurements used by the real keyboard sensor.
      vi.spyOn(screen.getByRole('row', { name: /Artist One/ }), 'getBoundingClientRect').mockReturnValue(
        new DOMRect(0, 0, 200, 40),
      );
      vi.spyOn(screen.getByRole('row', { name: /Artist Two/ }), 'getBoundingClientRect').mockReturnValue(
        new DOMRect(0, 40, 200, 40),
      );
      const handle = screen.getByRole('button', { name: /Reorder.*Artist Two/i });
      handle.focus();
      await user.keyboard('[Space]');
      await waitFor(() => expect(handle).toHaveAttribute('aria-pressed', 'true'));
      await user.keyboard('[ArrowUp]');
      await user.keyboard('[Space]');
      await waitFor(() =>
        expect(actions.setReleaseArtistsAction).toHaveBeenCalledWith(
          'release-1',
          [
            { artistId: 'artist-2', sortOrder: 0 },
            { artistId: 'artist-1', sortOrder: 1 },
          ],
          [
            { artistId: 'artist-1', sortOrder: 0 },
            { artistId: 'artist-2', sortOrder: 1 },
          ],
          { itemId: 'artist-2', previousItemId: undefined, nextItemId: 'artist-1' },
          'reorder-editor-origin',
        ),
      );
      expect(onArtistsChange).toHaveBeenCalledWith([
        { ...artists[1], sort_order: 0 },
        { ...artists[0], sort_order: 1 },
      ]);
    } finally {
      unmount();
      client.clear();
    }
  });
});
