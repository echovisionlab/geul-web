import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getArtistAdminAction: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));
vi.mock('@/features/artist/ArtistEditor/ArtistDetailEditor', () => ({
  ArtistDetailEditor: ({ id }: { id: string }) => <div>editor:{id}</div>,
}));
vi.mock('@/lib/actions/artist', () => ({ getArtistAdminAction: mocks.getArtistAdminAction }));
vi.mock('@/lib/queries/manifest', () => ({ getSettings: vi.fn() }));
vi.mock('@/lib/utils/og', () => ({ buildStaticOgMetadata: vi.fn() }));
vi.mock('@/lib/utils/route-metadata', () => ({ withNoIndex: vi.fn() }));
vi.mock('@/lib/utils/session.server', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/utils/url.server', () => ({ getBaseUrl: vi.fn(async () => 'https://example.test') }));

import { renderArtistEditRoute } from './ArtistEditRoute';

const ARTIST_ID = '00000000-0000-4000-8000-000000000003';
const artist = { id: ARTIST_ID, name: 'Artist', slug: 'artist-slug' };

describe('Artist edit query route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: 'member-1', nickname: 'Manager', role: 'user' } });
    mocks.getArtistAdminAction.mockResolvedValue(artist);
  });

  it('redirects an anonymous request to login before looking up the Artist', async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(renderArtistEditRoute('private-artist', { edit: 'true', lang: 'ko' })).rejects.toThrow(
      'redirect:/login?redirect=%2Fartists%2Fprivate-artist%3Fedit%3Dtrue%26lang%3Dko',
    );
    expect(mocks.getArtistAdminAction).not.toHaveBeenCalled();
  });

  it('does not distinguish an unauthorized Artist from a missing Artist', async () => {
    mocks.getArtistAdminAction.mockResolvedValue(null);

    await expect(renderArtistEditRoute('hidden-artist', { edit: 'true' })).rejects.toThrow('not-found');
  });

  it('canonicalizes an authorized slug to the immutable ID after the authority lookup', async () => {
    await expect(renderArtistEditRoute('artist-slug', { edit: 'true', lang: 'ja' })).rejects.toThrow(
      `redirect:/artists/${ARTIST_ID}?edit=true&lang=ja`,
    );
    expect(mocks.getArtistAdminAction).toHaveBeenCalledWith('artist-slug');
  });

  it('renders the existing editor for its immutable ID', async () => {
    const html = renderToStaticMarkup(await renderArtistEditRoute(ARTIST_ID, { edit: 'true' }));

    expect(html).toContain(`editor:${ARTIST_ID}`);
    expect(mocks.getArtistAdminAction).toHaveBeenCalledWith(ARTIST_ID);
  });
});
