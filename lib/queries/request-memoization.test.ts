import { PageStatus } from '@echovisionlab/geul-proto/public/page_pb.ts';
import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  manifestGet: vi.fn(),
  pageGet: vi.fn(),
  createManifestClient: vi.fn(),
  createPublicPageClient: vi.fn(),
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
  createPublicPageClient: mocks.createPublicPageClient,
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
  beforeEach(() => {
    vi.resetModules();
    mocks.manifestGet.mockReset();
    mocks.pageGet.mockReset();
    mocks.createManifestClient.mockReset();
    mocks.createPublicPageClient.mockReset();
    mocks.createPublicPageClientWithAuth.mockReset();

    mocks.createManifestClient.mockResolvedValue({ get: mocks.manifestGet });
    mocks.createPublicPageClient.mockReturnValue({ get: mocks.pageGet });
    mocks.createPublicPageClientWithAuth.mockResolvedValue({ get: mocks.pageGet });
    mocks.manifestGet.mockResolvedValue({
      settings: {
        siteTitle: 'Example Studio',
        metaDescription: 'Site description',
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
  });

  it('collapses the traced homepage read pattern to one manifest and one Page RPC', async () => {
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
    expect(mocks.pageGet).toHaveBeenCalledTimes(1);
  });

  it('shares named-page metadata and body reads for a decoded slug and normalized locale', async () => {
    const { getPublicPage } = await import('./manifest');
    const { getPageMetadataDocument } = await import('./metadata');

    mocks.pageGet.mockResolvedValue({
      page: {
        id: 'about-page',
        title: 'About',
        slug: 'about us',
        summary: 'About us',
        status: PageStatus.PUBLISHED,
        showTitle: true,
      },
      blockMedia: [],
    });

    const [metadata, body] = await Promise.all([
      getPageMetadataDocument('about%20us', { requestedLocale: ' en ' }),
      getPublicPage('about%20us', { requestedLocale: 'en' }),
    ]);

    expect(metadata).toMatchObject({ id: 'about-page', title: 'About', routePath: '/about us' });
    expect(body).toMatchObject({ id: 'about-page', title: 'About' });
    expect(mocks.pageGet).toHaveBeenCalledTimes(1);
    expect(mocks.pageGet).toHaveBeenCalledWith({ slug: 'about us' });
    expect(mocks.createPublicPageClientWithAuth).toHaveBeenCalledTimes(1);
    expect(mocks.createPublicPageClientWithAuth).toHaveBeenCalledWith('en');
    expect(mocks.createPublicPageClient).not.toHaveBeenCalled();
  });

  it('keeps public Page responses separate across requested locales', async () => {
    const englishGet = vi
      .fn()
      .mockResolvedValue({ page: { id: 'about', title: 'About', status: PageStatus.PUBLISHED } });
    const koreanGet = vi.fn().mockResolvedValue({ page: { id: 'about', title: '소개', status: PageStatus.PUBLISHED } });
    mocks.createPublicPageClientWithAuth.mockImplementation(async (locale: string | null | undefined) => ({
      get: locale === 'ko' ? koreanGet : englishGet,
    }));
    const { getPublicPage } = await import('./manifest');

    const [english, korean] = await Promise.all([
      getPublicPage('about', { requestedLocale: 'en' }),
      getPublicPage('about', { requestedLocale: 'ko' }),
    ]);

    expect(english?.title).toBe('About');
    expect(korean?.title).toBe('소개');
    expect(englishGet).toHaveBeenCalledTimes(1);
    expect(koreanGet).toHaveBeenCalledTimes(1);
    expect(mocks.createPublicPageClientWithAuth).toHaveBeenNthCalledWith(1, 'en');
    expect(mocks.createPublicPageClientWithAuth).toHaveBeenNthCalledWith(2, 'ko');
  });

  it('shares a Page source-locale fallback with a same-locale body read', async () => {
    const englishGet = vi.fn().mockResolvedValue({
      page: {
        id: 'about',
        title: 'About',
        status: PageStatus.PUBLISHED,
        localizationInfo: { displayedLocale: 'en', sourceLocale: 'ko', availableLocales: ['en', 'ko'] },
      },
    });
    const koreanGet = vi.fn().mockResolvedValue({
      page: {
        id: 'about',
        title: '소개',
        status: PageStatus.PUBLISHED,
        localizationInfo: { displayedLocale: 'ko', sourceLocale: 'ko', availableLocales: ['en', 'ko'] },
      },
      blockMedia: [],
    });
    mocks.createPublicPageClientWithAuth.mockImplementation(async (locale: string | null | undefined) => ({
      get: locale === 'ko' ? koreanGet : englishGet,
    }));
    const { getPublicPage } = await import('./manifest');
    const { getPageMetadataDocument } = await import('./metadata');

    const [metadata, sourceBody] = await Promise.all([
      getPageMetadataDocument('about', { requestedLocale: 'en', preferSourceLocale: true }),
      getPublicPage('about', { requestedLocale: 'ko' }),
    ]);

    expect(metadata?.title).toBe('소개');
    expect(sourceBody?.title).toBe('소개');
    expect(englishGet).toHaveBeenCalledTimes(1);
    expect(koreanGet).toHaveBeenCalledTimes(1);
    expect(mocks.createPublicPageClientWithAuth).toHaveBeenNthCalledWith(1, 'en');
    expect(mocks.createPublicPageClientWithAuth).toHaveBeenNthCalledWith(2, 'ko');
  });

  it('preserves Page NotFound results for metadata defaults and body nulls', async () => {
    mocks.pageGet.mockRejectedValue(new ConnectError('missing', Code.NotFound));
    const { getPublicPage } = await import('./manifest');
    const { getHomeMetadataDocument, getPageMetadataDocument } = await import('./metadata');

    const [home, homeBody, pageMetadata] = await Promise.all([
      getHomeMetadataDocument({ requestedLocale: 'en' }),
      getPublicPage('/', { requestedLocale: 'en' }),
      getPageMetadataDocument('about', { requestedLocale: 'en' }),
    ]);

    expect(home).toMatchObject({ title: 'Example Studio', summary: 'Site description', ogImageUrl: null });
    expect(homeBody).toBeNull();
    expect(pageMetadata).toBeNull();
    expect(mocks.pageGet).toHaveBeenCalledTimes(2);
  });

  it('preserves transient Page error behavior for home, page metadata, and body reads', async () => {
    mocks.pageGet.mockRejectedValue(new ConnectError('temporarily unavailable', Code.Unavailable));
    const { getPublicPage } = await import('./manifest');
    const { getHomeMetadataDocument, getPageMetadataDocument } = await import('./metadata');

    const results = await Promise.allSettled([
      getHomeMetadataDocument({ requestedLocale: 'en' }),
      getPublicPage('/', { requestedLocale: 'en' }),
      getPageMetadataDocument('about', { requestedLocale: 'en' }),
    ]);

    expect(results[0]?.status).toBe('rejected');
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: expect.objectContaining({ code: Code.Unavailable }),
    });
    expect(results[2]).toMatchObject({ status: 'fulfilled', value: null });
    expect(mocks.pageGet).toHaveBeenCalledTimes(2);
  });

  it('shares home metadata and body reads through the unauthenticated public client without a locale', async () => {
    const { getPublicPage } = await import('./manifest');
    const { getHomeMetadataDocument } = await import('./metadata');

    await Promise.all([getHomeMetadataDocument(), getPublicPage('/')]);

    expect(mocks.createPublicPageClient).toHaveBeenCalledTimes(1);
    expect(mocks.createPublicPageClientWithAuth).not.toHaveBeenCalled();
    expect(mocks.pageGet).toHaveBeenCalledTimes(1);
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
