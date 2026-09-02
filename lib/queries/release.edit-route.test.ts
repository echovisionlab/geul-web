import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Code, ConnectError } from '@connectrpc/connect';

const mocks = vi.hoisted(() => ({ publicGet: vi.fn() }));

vi.mock('@/lib/api/server-client', () => ({
  createPublicReleaseClient: vi.fn(),
  createPublicReleaseClientWithAuth: vi.fn(async () => ({ get: mocks.publicGet })),
  createReleaseClient: vi.fn(),
}));

import { resolveReleaseIdForEdit } from './release';

describe('resolveReleaseIdForEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves either a public slug or UUID to the authoritative Release ID', async () => {
    mocks.publicGet.mockResolvedValue({ release: { id: 'release-1' } });

    await expect(resolveReleaseIdForEdit('release-slug')).resolves.toBe('release-1');
    expect(mocks.publicGet).toHaveBeenCalledWith({ slug: 'release-slug' });
  });

  it('returns null for missing or inaccessible releases', async () => {
    mocks.publicGet.mockRejectedValue(new ConnectError('missing', Code.NotFound));

    await expect(resolveReleaseIdForEdit('missing')).resolves.toBeNull();
  });
});
