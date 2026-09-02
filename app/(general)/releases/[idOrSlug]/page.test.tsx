import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareLinkEntityType } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import ReleaseViewPage from './page';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getReleasePublic: vi.fn(),
  resolveReleaseIdForEdit: vi.fn(),
  getReleaseAdminAction: vi.fn(),
  listTracksByReleaseAction: vi.fn(),
  validateShareLink: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn(async () => (key: string) => key) }));
vi.mock('@/lib/utils/session.server', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/queries/release', () => ({
  getReleasePublic: mocks.getReleasePublic,
  resolveReleaseIdForEdit: mocks.resolveReleaseIdForEdit,
}));
vi.mock('@/lib/actions/release', () => ({ getReleaseAdminAction: mocks.getReleaseAdminAction }));
vi.mock('@/lib/actions/track', () => ({ listTracksByReleaseAction: mocks.listTracksByReleaseAction }));
vi.mock('@/lib/api/server-client', () => ({
  createPublicShareLinkClient: vi.fn(() => ({ validate: mocks.validateShareLink })),
}));
vi.mock('@/lib/queries/metadata', () => ({
  getReleaseMetadataDocument: vi.fn(async () => null),
  getSiteMetadataDocument: vi.fn(async () => ({ canonicalOrigin: 'https://example.test' })),
}));
vi.mock('@/lib/utils/language.server', () => ({ getUserLocale: vi.fn(async () => 'en') }));
vi.mock('@/lib/utils/header.server', () => ({ getRequestHeaders: vi.fn(async () => new Headers()) }));
vi.mock('@/lib/utils/url.server', () => ({ getBaseUrl: vi.fn(async () => 'https://example.test') }));
vi.mock('@/features/release/ReleaseEditor/ReleaseEditor', () => ({ ReleaseEditor: vi.fn(() => null) }));
vi.mock('./ReleaseTrackAudioPlayer', () => ({ ReleaseTrackAudioPlayer: vi.fn(() => null) }));
vi.mock('./ReleasePublicContent', () => ({ ReleasePublicContent: vi.fn(async () => null) }));
vi.mock('./ReleaseShareViewClient', () => ({ ReleaseShareViewClient: vi.fn(() => null) }));

function props(
  searchParams: Record<string, string | string[] | undefined> = { edit: 'true' },
  idOrSlug = 'release-slug',
) {
  return {
    params: Promise.resolve({ idOrSlug }),
    searchParams: Promise.resolve(searchParams),
  };
}

describe('Release canonical editor route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: 'member-1', nickname: 'Admin', role: 'admin' } });
    mocks.resolveReleaseIdForEdit.mockResolvedValue('release-1');
    mocks.getReleaseAdminAction.mockResolvedValue({
      id: 'release-1',
      title: 'Release',
      slug: 'release-slug',
      type: 'album',
      releaseDate: null,
      artworkUrl: null,
      status: 'draft',
      spotifyUrl: null,
      appleMusicUrl: null,
      bandcampUrl: null,
      youtubeMusicUrl: null,
    });
    mocks.listTracksByReleaseAction.mockResolvedValue([]);
    mocks.validateShareLink.mockResolvedValue({
      valid: true,
      passwordRequired: false,
      entityType: ShareLinkEntityType.RELEASE,
    });
  });

  it('redirects an anonymous edit request to login with the exact route before entity lookup', async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(ReleaseViewPage(props({ edit: 'true', lang: 'ko' }))).rejects.toThrow(
      'redirect:/login?redirect=%2Freleases%2Frelease-slug%3Fedit%3Dtrue%26lang%3Dko',
    );
    expect(mocks.resolveReleaseIdForEdit).not.toHaveBeenCalled();
  });

  it('returns the same not-found result for a non-admin session without entity lookup', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'member-1', role: 'author' } });

    await expect(ReleaseViewPage(props())).rejects.toThrow('not-found');
    expect(mocks.resolveReleaseIdForEdit).not.toHaveBeenCalled();
  });

  it('resolves an authorized slug and canonicalizes it to the immutable ID', async () => {
    await expect(ReleaseViewPage(props({ edit: 'true', lang: 'ja' }))).rejects.toThrow(
      'redirect:/releases/release-1?edit=true&lang=ja',
    );

    expect(mocks.resolveReleaseIdForEdit).toHaveBeenCalledWith('release-slug');
    expect(mocks.getReleaseAdminAction).not.toHaveBeenCalled();
  });

  it('renders the existing editor at its immutable ID', async () => {
    const result = await ReleaseViewPage(props({ edit: 'true' }, 'release-1'));

    expect(mocks.resolveReleaseIdForEdit).toHaveBeenCalledWith('release-1');
    expect(mocks.getReleaseAdminAction).toHaveBeenCalledWith('release-1');
    expect(result.props).toMatchObject({ releaseId: 'release-1', initialSlug: 'release-slug' });
  });

  it('keeps a protected Release on its canonical route and renders the password form before fetching it', async () => {
    mocks.validateShareLink.mockResolvedValue({
      valid: false,
      passwordRequired: true,
      entityType: ShareLinkEntityType.RELEASE,
      entityId: 'release-1',
      slug: 'release-slug',
    });

    const result = await ReleaseViewPage(props({ share: 'protected-token' }));

    expect(mocks.validateShareLink).toHaveBeenCalledWith({ token: 'protected-token' });
    expect(mocks.getReleasePublic).not.toHaveBeenCalled();
    expect(result.props).toEqual({
      token: 'protected-token',
      idOrSlug: 'release-slug',
      requestedLocale: 'en',
      uiLocale: 'en',
    });
  });
});
