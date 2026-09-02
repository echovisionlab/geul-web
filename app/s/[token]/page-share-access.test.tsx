import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accessPageShareAction } from './page-share-access';

const mocks = vi.hoisted(() => ({
  getPageViewWithToken: vi.fn(),
}));

vi.mock('@/lib/queries/page', () => ({
  getPageViewWithToken: mocks.getPageViewWithToken,
}));
vi.mock('./PageShareContent', () => ({ PageShareContent: vi.fn(() => null) }));

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

describe('accessPageShareAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the password in the current submission and opens the Page once', async () => {
    const page = { id: 'page-1', slug: 'shared-page' };
    mocks.getPageViewWithToken.mockResolvedValue(page);

    const result = await accessPageShareAction(
      {},
      form({
        token: 'share-token',
        idOrSlug: 'shared-page',
        requestedLocale: 'ko',
        password: 'secret',
      }),
    );

    expect(result.error).toBeUndefined();
    expect(result.content).toBeDefined();
    expect(mocks.getPageViewWithToken).toHaveBeenCalledOnce();
    expect(mocks.getPageViewWithToken).toHaveBeenCalledWith('shared-page', 'share-token', 'ko', 'secret');
  });

  it('does not query without a password and distinguishes a missing Page', async () => {
    await expect(
      accessPageShareAction({}, form({ token: 'share-token', idOrSlug: 'shared-page', password: '' })),
    ).resolves.toEqual({ error: 'incorrect_password' });
    expect(mocks.getPageViewWithToken).not.toHaveBeenCalled();

    mocks.getPageViewWithToken.mockResolvedValue(null);
    await expect(
      accessPageShareAction({}, form({ token: 'share-token', idOrSlug: 'shared-page', password: 'secret' })),
    ).resolves.toEqual({ error: 'not_found' });
  });

  it('returns the same generic password failure for a rejected authorization', async () => {
    mocks.getPageViewWithToken.mockRejectedValue(new Error('permission denied'));
    await expect(
      accessPageShareAction({}, form({ token: 'share-token', idOrSlug: 'shared-page', password: 'wrong' })),
    ).resolves.toEqual({ error: 'incorrect_password' });
  });
});
