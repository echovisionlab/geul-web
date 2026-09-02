import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accessReleaseShareAction } from './release-share-access';

const mocks = vi.hoisted(() => ({
  getReleasePublic: vi.fn(),
  renderRelease: vi.fn(),
}));

vi.mock('@/lib/queries/release', () => ({ getReleasePublic: mocks.getReleasePublic }));
vi.mock('./ReleasePublicContent', () => ({ ReleasePublicContent: mocks.renderRelease }));

function form(password: string) {
  const data = new FormData();
  data.set('token', 'share-token');
  data.set('idOrSlug', 'release-1');
  data.set('requestedLocale', 'ko');
  data.set('uiLocale', 'ko');
  data.set('password', password);
  return data;
}

describe('accessReleaseShareAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.renderRelease.mockResolvedValue('release-content');
  });

  it('keeps the password in memory and returns the canonical Release view', async () => {
    const release = { id: 'release-1', tracks: [] };
    mocks.getReleasePublic.mockResolvedValue(release);

    await expect(accessReleaseShareAction({}, form('secret'))).resolves.toEqual({
      content: 'release-content',
    });
    expect(mocks.getReleasePublic).toHaveBeenCalledWith('release-1', 'share-token', {
      requestedLocale: 'ko',
      sharePassword: 'secret',
    });
    expect(mocks.renderRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        release,
        query: { share: 'share-token' },
        sharePassword: 'secret',
      }),
    );
  });

  it('does not fetch without a password', async () => {
    await expect(accessReleaseShareAction({}, form(''))).resolves.toEqual({
      error: 'incorrect_password',
    });
    expect(mocks.getReleasePublic).not.toHaveBeenCalled();
  });
});
