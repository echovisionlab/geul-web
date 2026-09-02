import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('forwards persisted IDs and omits new empty IDs in the RPC payload', async () => {
    await expect(
      actions.setTrackCreditsAction('track-1', [
        { id: '', sort_order: 0 },
        { id: 'credit-1', sort_order: 1 },
      ]),
    ).resolves.toEqual({ success: true });

    expect(trackClient.setTrackCredits).toHaveBeenCalledWith({
      trackId: 'track-1',
      credits: [
        expect.objectContaining({ id: undefined, sortOrder: 0 }),
        expect.objectContaining({ id: 'credit-1', sortOrder: 1 }),
      ],
    });
  });
});
