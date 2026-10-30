import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Code } from '@connectrpc/connect';
import * as actions from './track';

const mocks = vi.hoisted(() => ({
  createTrackClient: vi.fn(),
}));

const trackClient = vi.hoisted(() => ({
  setTrackCredits: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createTrackClient: mocks.createTrackClient,
}));

describe('track credit action mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createTrackClient.mockResolvedValue(trackClient);
    trackClient.setTrackCredits.mockResolvedValue({});
  });

  it('rejects track credit writes without an observed baseline', async () => {
    await expect(actions.setTrackCreditsAction('track-1', [], undefined as never)).resolves.toEqual({
      ok: false,
      error: 'An observed credit snapshot is required',
      errorCode: Code.InvalidArgument,
    });
    expect(trackClient.setTrackCredits).not.toHaveBeenCalled();
  });

  it('includes an observed credit snapshot without converting a new row ID into a persisted ID', async () => {
    await expect(
      actions.setTrackCreditsAction(
        'track-1',
        [{ id: '', credited_name: 'New credit', sort_order: 1 }],
        [{ id: 'credit-1', artist_id: 'artist-1', sort_order: 0 }],
      ),
    ).resolves.toEqual({ ok: true, success: true });

    expect(trackClient.setTrackCredits).toHaveBeenCalledWith({
      trackId: 'track-1',
      credits: [expect.objectContaining({ id: undefined, creditedName: 'New credit', sortOrder: 1 })],
      observed: {
        credits: [expect.objectContaining({ id: 'credit-1', artistId: 'artist-1', sortOrder: 0 })],
      },
    });
  });
});
