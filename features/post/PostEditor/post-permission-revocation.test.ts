import { describe, expect, it, vi } from 'vitest';
import { navigateAfterPostPermissionRevoked } from './post-permission-revocation';

describe('navigateAfterPostPermissionRevoked', () => {
  it('uses the latest resolved Post destination', async () => {
    const navigate = vi.fn();
    await expect(
      navigateAfterPostPermissionRevoked('post-1', vi.fn().mockResolvedValue('/posts/latest-slug'), navigate),
    ).resolves.toBe(true);
    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/posts/latest-slug');
  });

  it('falls back to home when the fresh read or first navigation fails', async () => {
    const lookupFailureNavigate = vi.fn();
    await expect(
      navigateAfterPostPermissionRevoked(
        'post-1',
        vi.fn().mockRejectedValue(new Error('network')),
        lookupFailureNavigate,
      ),
    ).resolves.toBe(true);
    expect(lookupFailureNavigate).toHaveBeenCalledWith('/');

    const navigate = vi.fn((destination: string) => {
      if (destination !== '/') {
        throw new Error('route failed');
      }
    });
    await expect(
      navigateAfterPostPermissionRevoked('post-1', vi.fn().mockResolvedValue('/posts/latest-slug'), navigate),
    ).resolves.toBe(true);
    expect(navigate.mock.calls).toEqual([['/posts/latest-slug'], ['/']]);
  });

  it('reports failure when even the home fallback cannot navigate', async () => {
    await expect(
      navigateAfterPostPermissionRevoked(
        'post-1',
        vi.fn().mockResolvedValue('/posts/latest-slug'),
        vi.fn(() => {
          throw new Error('blocked');
        }),
      ),
    ).resolves.toBe(false);
  });
});
