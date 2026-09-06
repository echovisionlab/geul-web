// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { reorderTracksAction } from '@/lib/actions/track';
import type { ReleaseTrackItem } from '@/lib/collab/schemas/release-fields.schema';
import { restoreTrackOrder, useTrackOrderSave } from './useTrackOrderSave';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));
vi.mock('@/lib/actions/track', () => ({ reorderTracksAction: vi.fn() }));
const track = (id: string, number: number): ReleaseTrackItem => ({
  id,
  title: id,
  track_number: number,
  duration_seconds: 0,
  audio_attached: false,
  processing_status: null,
  credits: [],
});
const initial = [track('one', 1), track('two', 2), track('three', 3)];
let root: Root, client: QueryClient;
let save: ReturnType<typeof useTrackOrderSave>;
let current: ReleaseTrackItem[];
function Editor() {
  const [tracks, setTracks] = useState(initial);
  current = tracks;
  save = useTrackOrderSave({ releaseId: 'release', tracks, onTracksChange: setTracks });
  return null;
}
beforeEach(() => {
  vi.resetAllMocks();
  root = createRoot(document.createElement('div'));
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <Editor />
      </QueryClientProvider>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  client.clear();
});

it('serializes rapid reorders and restores the last acknowledged order after a later failure', async () => {
  let finish!: (value: { success: boolean }) => void;
  vi.mocked(reorderTracksAction)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce({ error: 'offline' });
  const first = restoreTrackOrder(initial, ['two', 'one', 'three']);
  const second = restoreTrackOrder(initial, ['three', 'two', 'one']);
  await act(async () => {
    save(first);
  });
  await act(async () => {
    save(second);
  });
  expect(reorderTracksAction).toHaveBeenCalledTimes(1);
  expect(current.map((item) => item.id)).toEqual(['three', 'two', 'one']);
  await act(async () => {
    finish({ success: true });
  });
  expect(reorderTracksAction).toHaveBeenCalledTimes(2);
  expect(current).toEqual(first);
});

it('restores only ordering, preserving edits and current membership', () => {
  const updated = { ...initial[1], title: 'edited title' };
  const result = restoreTrackOrder([track('new', 1), updated], ['one', 'two', 'three']);
  expect(result.map((item) => item.id)).toEqual(['two', 'new']);
  expect(result[0].title).toBe('edited title');
  expect(result.map((item) => item.track_number)).toEqual([1, 2]);
});
