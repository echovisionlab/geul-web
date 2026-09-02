import { PageStatus } from '@echovisionlab/geul-proto/public/page_pb.ts';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  manifestGet: vi.fn(),
  pageGet: vi.fn(),
  createManifestClient: vi.fn(),
  createPublicPageClientWithAuth: vi.fn(),
}));

vi.mock('react', () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => {
    const values = new Map<string, ReturnType<T>>();
    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args);
      if (!values.has(key)) {
        values.set(key, fn(...args) as ReturnType<T>);
      }
      return values.get(key);
    }) as T;
  },
}));

vi.mock('@/lib/api/server-client', () => ({
  createManifestClient: mocks.createManifestClient,
  createPublicManifestClient: vi.fn(),
  createPublicArtistClientWithAuth: vi.fn(),
  createPublicFormClientWithAuth: vi.fn(),
  createPublicLabelClientWithAuth: vi.fn(),
  createPublicPageClient: vi.fn(),
  createPublicPageClientWithAuth: mocks.createPublicPageClientWithAuth,
  createPublicPostClientWithAuth: vi.fn(),
  createPublicReleaseClientWithAuth: vi.fn(),
  createPublicMemberClient: vi.fn(),
  createPublicWorkClientWithAuth: vi.fn(),
}));

vi.mock('@/lib/queries/taxonomy', () => ({
  getPublicCategoryBySlug: vi.fn(),
  getPublicTagBySlug: vi.fn(),
}));

describe('server query request memoization', () => {
  it('collapses the traced homepage read pattern to one manifest and two page RPCs', async () => {
    mocks.manifestGet.mockResolvedValue({
      settings: {
        siteTitle: 'Example Studio',
        siteOrigin: 'https://studio.example.com',
        socialLinks: {},
      },
      menus: { header: [] },
    });
    mocks.pageGet.mockResolvedValue({
      page: {
        id: 'home-page',
        title: 'Home',
        slug: '/',
        status: PageStatus.PUBLISHED,
        showTitle: false,
        blockMedia: [],
      },
      blockMedia: [],
    });
    mocks.createManifestClient.mockResolvedValue({ get: mocks.manifestGet });
    mocks.createPublicPageClientWithAuth.mockResolvedValue({ get: mocks.pageGet });

    const { getManifest, getPublicPage } = await import('./manifest');
    const { getHomeMetadataDocument, getSiteMetadataDocument } = await import('./metadata');
    const options = { requestedLocale: 'en' };

    await Promise.all([
      getManifest(options),
      getSiteMetadataDocument(options),
      getManifest({ requestedLocale: 'en' }),
      getHomeMetadataDocument(options),
      getHomeMetadataDocument({ requestedLocale: 'en' }),
      getPublicPage('/', options),
      getPublicPage('/', { requestedLocale: 'en' }),
    ]);

    expect(mocks.manifestGet).toHaveBeenCalledTimes(1);
    expect(mocks.pageGet).toHaveBeenCalledTimes(2);
  });

  it('does not share request memoization across locales', async () => {
    mocks.manifestGet.mockClear();
    mocks.createManifestClient.mockClear();
    mocks.createManifestClient.mockResolvedValue({ get: mocks.manifestGet });
    mocks.manifestGet.mockResolvedValue({
      settings: {
        siteTitle: 'Example Studio',
        siteOrigin: 'https://studio.example.com',
        socialLinks: {},
      },
      menus: { header: [] },
    });

    const { getManifest } = await import('./manifest');
    await Promise.all([getManifest({ requestedLocale: 'fr' }), getManifest({ requestedLocale: 'ko' })]);

    expect(mocks.manifestGet).toHaveBeenCalledTimes(2);
    expect(mocks.createManifestClient).toHaveBeenCalledWith('fr');
    expect(mocks.createManifestClient).toHaveBeenCalledWith('ko');
  });
});
