import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkPageSlugAvailable } from './page-browser';

const mocks = vi.hoisted(() => ({
  checkPageSlugAvailable: vi.fn(),
}));

vi.mock('@/lib/api/browser-client', () => ({
  createPageClient: vi.fn(() => ({
    checkPageSlugAvailable: mocks.checkPageSlugAvailable,
  })),
}));

describe('checkPageSlugAvailable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates edit to the Page authority because it is a valid Page slug', async () => {
    mocks.checkPageSlugAvailable.mockResolvedValue({ available: true });

    await expect(checkPageSlugAvailable('edit', 'page-1')).resolves.toEqual({ available: true });
    expect(mocks.checkPageSlugAvailable).toHaveBeenCalledWith({
      slug: 'edit',
      excludeId: 'page-1',
    });
  });

  it('distinguishes a reserved top-level route from a valid nested resource path', async () => {
    mocks.checkPageSlugAvailable.mockResolvedValue({ available: false });

    await expect(checkPageSlugAvailable('admin')).resolves.toEqual({
      available: false,
      reason: 'reservedRoute',
    });
    await expect(checkPageSlugAvailable('events/example')).resolves.toEqual({
      available: false,
      reason: 'alreadyExists',
    });
    expect(mocks.checkPageSlugAvailable).toHaveBeenLastCalledWith({
      slug: 'events/example',
      excludeId: undefined,
    });
  });

  it.each([
    ['/about', 'emptySegment'],
    ['about/', 'emptySegment'],
    ['about//team', 'emptySegment'],
    ['about/../team', 'dotSegment'],
    [' about', 'invalidPath'],
  ] as const)('distinguishes invalid Page path %s', async (slug, reason) => {
    mocks.checkPageSlugAvailable.mockResolvedValue({ available: false });
    await expect(checkPageSlugAvailable(slug)).resolves.toEqual({ available: false, reason });
  });

  it('reports a duplicate only after a valid path is unavailable', async () => {
    mocks.checkPageSlugAvailable.mockResolvedValue({ available: false });
    await expect(checkPageSlugAvailable('some/where')).resolves.toEqual({
      available: false,
      reason: 'alreadyExists',
    });
  });

  it('distinguishes an availability check failure from a duplicate', async () => {
    mocks.checkPageSlugAvailable.mockRejectedValue(new Error('offline'));
    await expect(checkPageSlugAvailable('some/where')).resolves.toEqual({
      available: false,
      reason: 'checkFailed',
    });
  });
});
