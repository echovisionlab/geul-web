import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMyProfile } from './my-account';

const mocks = vi.hoisted(() => ({
  createMemberClient: vi.fn(),
  getMyProfile: vi.fn(),
  getMySections: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createMemberClient: mocks.createMemberClient,
}));

describe('my account projections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createMemberClient.mockResolvedValue({
      getMyProfile: mocks.getMyProfile,
      getMySections: mocks.getMySections,
    });
  });

  it('rejects an incomplete profile projection', async () => {
    mocks.getMyProfile.mockResolvedValue({
      member: { summary: { id: 'member-1', nickname: '', deleted: false } },
    });

    await expect(getMyProfile()).resolves.toBeNull();
  });
});
