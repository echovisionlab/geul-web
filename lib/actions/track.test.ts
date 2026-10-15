import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as actions from './track';

const mocks = vi.hoisted(() => ({
  createTrackClient: vi.fn(),
  revalidatePath: vi.fn(),
}));
const trackClient = vi.hoisted(() => ({
  createTrack: vi.fn(),
  updateTrack: vi.fn(),
  deleteTrack: vi.fn(),
  reorderTracks: vi.fn(),
  setTrackCredits: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({ createTrackClient: mocks.createTrackClient }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createTrackClient.mockResolvedValue(trackClient);
  trackClient.createTrack.mockResolvedValue({ id: 'track-1', releaseId: 'release-1', trackNumber: 1, title: 'Track' });
});

describe('track configuration write origins', () => {
  const origin = '30000000-0000-4000-8000-000000000004';

  it.each([
    ['create', () => actions.createTrackAction({ release_id: 'release-1', track_number: 1, title: 'Track' }, origin)],
    ['update', () => actions.updateTrackAction('track-1', { title: 'Track', duration_seconds: null }, origin)],
    ['delete', () => actions.deleteTrackAction('track-1', origin)],
    ['reorder', () => actions.reorderTracksAction(['track-1'], origin)],
    ['credits', () => actions.setTrackCreditsAction('track-1', [{ credited_name: 'Writer' }], [], origin)],
  ] as const)('forwards the explicit origin for %s', async (_operation, save) => {
    const result = await save();
    expect(result).not.toHaveProperty('error');
    expect(mocks.createTrackClient).toHaveBeenCalledExactlyOnceWith(origin);
  });

  it('preserves the observed credit guard alongside the origin', async () => {
    await actions.setTrackCreditsAction(
      'track-1',
      [{ id: 'credit-1', credited_name: 'Writer', sort_order: 0 }],
      [{ id: 'credit-1', credited_name: 'Original Writer', sort_order: 0 }],
      origin,
    );
    expect(trackClient.setTrackCredits).toHaveBeenCalledWith({
      trackId: 'track-1',
      credits: [expect.objectContaining({ id: 'credit-1', creditedName: 'Writer' })],
      observed: { credits: [expect.objectContaining({ id: 'credit-1', creditedName: 'Original Writer' })] },
    });
  });
});
