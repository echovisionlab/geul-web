import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostAction } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import { accessPostShareAction } from './post-share';

const mocks = vi.hoisted(() => ({
  getPostViewWithToken: vi.fn(),
  getPostAllowedActions: vi.fn(),
}));

vi.mock('@/lib/queries/post', () => ({
  getPostViewWithToken: mocks.getPostViewWithToken,
  getPostAllowedActions: mocks.getPostAllowedActions,
}));

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

describe('accessPostShareAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPostAllowedActions.mockResolvedValue([PostAction.EDIT]);
  });

  it('keeps the password in the current submission and opens the Post once', async () => {
    const post = { id: 'post-1', slug: 'shared-post' };
    mocks.getPostViewWithToken.mockResolvedValue(post);

    await expect(
      accessPostShareAction(
        {},
        form({ token: 'share-token', idOrSlug: 'shared-post', requestedLocale: 'ko', password: 'secret' }),
      ),
    ).resolves.toEqual({ post, allowedActions: [PostAction.EDIT], requestedLocale: 'ko' });
    expect(mocks.getPostViewWithToken).toHaveBeenCalledOnce();
    expect(mocks.getPostViewWithToken).toHaveBeenCalledWith('shared-post', 'share-token', 'ko', 'secret');
  });

  it('does not query without a password and distinguishes a missing Post', async () => {
    await expect(
      accessPostShareAction({}, form({ token: 'share-token', idOrSlug: 'shared-post', password: '' })),
    ).resolves.toEqual({ error: 'incorrect_password' });
    expect(mocks.getPostViewWithToken).not.toHaveBeenCalled();

    mocks.getPostViewWithToken.mockResolvedValue(null);
    await expect(
      accessPostShareAction({}, form({ token: 'share-token', idOrSlug: 'shared-post', password: 'secret' })),
    ).resolves.toEqual({ error: 'not_found' });
  });

  it('returns the same generic password failure for a rejected authorization', async () => {
    mocks.getPostViewWithToken.mockRejectedValue(new Error('permission denied'));
    await expect(
      accessPostShareAction({}, form({ token: 'share-token', idOrSlug: 'shared-post', password: 'wrong' })),
    ).resolves.toEqual({ error: 'incorrect_password' });
  });
});
