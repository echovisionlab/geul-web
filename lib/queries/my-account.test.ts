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

  it('returns the canonical MemberProfile instead of inventing another detail shape', async () => {
    const profile = {
      summary: { id: 'member-1', nickname: 'Member', deleted: false },
      bio: 'Biography',
      website: 'https://example.test',
      socialLinks: { instagram: 'https://instagram.com/member' },
    };
    mocks.getMyProfile.mockResolvedValue({ member: profile });

    await expect(getMyProfile()).resolves.toBe(profile);
    expect(mocks.getMyProfile).toHaveBeenCalledWith({});
  });

  it('rejects an incomplete profile projection', async () => {
    mocks.getMyProfile.mockResolvedValue({
      member: { summary: { id: 'member-1', nickname: '', deleted: false } },
    });

    await expect(getMyProfile()).resolves.toBeNull();
  });
});
