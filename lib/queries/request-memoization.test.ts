import { PageStatus } from '@echovisionlab/geul-proto/public/page_pb.ts';
import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requestId: 0,
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
      const key = JSON.stringify([mocks.requestId, ...args]);
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
    mocks.requestId += 1;
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
    const { getPageView } = await import('./page');
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

    // Match the named route: resolve metadata before the body query starts.
    const metadata = await getPageMetadataDocument('about%20us', { requestedLocale: ' en ' });
    const body = await getPageView('about%20us', { requestedLocale: 'en' });

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
    const { getPageView } = await import('./page');

    const [english, korean] = await Promise.all([
      getPageView('about', { requestedLocale: 'en' }),
      getPageView('about', { requestedLocale: 'ko' }),
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
    const { getPageView } = await import('./page');
    const { getPageMetadataDocument } = await import('./metadata');

    const [metadata, sourceBody, preferredBody, englishBody] = await Promise.all([
      getPageMetadataDocument('about', { requestedLocale: 'en', preferSourceLocale: true }),
      getPageView('about', { requestedLocale: 'ko' }),
      getPageView('about', { requestedLocale: 'en', preferSourceLocale: true }),
      getPageView('about', { requestedLocale: 'en' }),
    ]);

    expect(metadata?.title).toBe('소개');
    expect(sourceBody?.title).toBe('소개');
    expect(preferredBody?.title).toBe('소개');
    expect(englishBody?.title).toBe('About');
    expect(englishGet).toHaveBeenCalledTimes(1);
    expect(koreanGet).toHaveBeenCalledTimes(1);
    expect(mocks.createPublicPageClientWithAuth).toHaveBeenNthCalledWith(1, 'en');
    expect(mocks.createPublicPageClientWithAuth).toHaveBeenNthCalledWith(2, 'ko');
  });

  it('preserves Page NotFound results for metadata defaults and body nulls', async () => {
    mocks.pageGet.mockRejectedValue(new ConnectError('missing', Code.NotFound));
    const { getPageView } = await import('./page');
    const { getPublicPage } = await import('./manifest');
    const { getHomeMetadataDocument, getPageMetadataDocument } = await import('./metadata');

    const [home, homeBody, pageMetadata, pageBody] = await Promise.all([
      getHomeMetadataDocument({ requestedLocale: 'en' }),
      getPublicPage('/', { requestedLocale: 'en' }),
      getPageMetadataDocument('about', { requestedLocale: 'en' }),
      getPageView('about', { requestedLocale: 'en' }),
    ]);

    expect(home).toMatchObject({ title: 'Example Studio', summary: 'Site description', ogImageUrl: null });
    expect(homeBody).toBeNull();
    expect(pageMetadata).toBeNull();
    expect(pageBody).toBeNull();
    expect(mocks.pageGet).toHaveBeenCalledTimes(2);
  });

  it('preserves transient Page error behavior for home, page metadata, and body reads', async () => {
    mocks.pageGet.mockRejectedValue(new ConnectError('temporarily unavailable', Code.Unavailable));
    const { getPageView } = await import('./page');
    const { getPublicPage } = await import('./manifest');
    const { getHomeMetadataDocument, getPageMetadataDocument } = await import('./metadata');

    const results = await Promise.allSettled([
      getHomeMetadataDocument({ requestedLocale: 'en' }),
      getPublicPage('/', { requestedLocale: 'en' }),
      getPageMetadataDocument('about', { requestedLocale: 'en' }),
      getPageView('about', { requestedLocale: 'en' }),
    ]);

    expect(results[0]?.status).toBe('rejected');
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: expect.objectContaining({ code: Code.Unavailable }),
    });
    expect(results[2]).toMatchObject({ status: 'fulfilled', value: null });
    expect(results[3]).toMatchObject({
      status: 'rejected',
      reason: expect.objectContaining({ code: Code.Unavailable }),
    });
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

  it.each([undefined, null, ''])(
    'preserves separate anonymous metadata and optional-auth body reads for locale %s',
    async (requestedLocale) => {
      const publicGet = vi
        .fn()
        .mockResolvedValue({ page: { id: 'published', title: 'Public', status: PageStatus.PUBLISHED } });
      const authenticatedGet = vi
        .fn()
        .mockResolvedValue({ page: { id: 'draft', title: 'Authorized draft', status: PageStatus.DRAFT } });
      mocks.createPublicPageClient.mockReturnValue({ get: publicGet });
      mocks.createPublicPageClientWithAuth.mockResolvedValue({ get: authenticatedGet });
      const { getPageMetadataDocument } = await import('./metadata');
      const { getPageView } = await import('./page');

      const metadata = await getPageMetadataDocument('about', { requestedLocale });
      const body = await getPageView('about', { requestedLocale });

      expect(metadata?.title).toBe('Public');
      expect(body?.title).toBe('Authorized draft');
      expect(publicGet).toHaveBeenCalledTimes(1);
      expect(authenticatedGet).toHaveBeenCalledTimes(1);
      expect(mocks.createPublicPageClientWithAuth).toHaveBeenCalledWith(null);
    },
  );

  it('shares authenticated draft responses while keeping metadata publication filtering', async () => {
    mocks.pageGet.mockResolvedValue({ page: { id: 'draft', title: 'Draft', status: PageStatus.DRAFT } });
    const { getPageMetadataDocument } = await import('./metadata');
    const { getPageView } = await import('./page');

    expect(await getPageMetadataDocument('draft', { requestedLocale: 'en' })).toBeNull();
    expect(await getPageView('draft', { requestedLocale: 'en' })).toMatchObject({ id: 'draft', title: 'Draft' });
    expect(mocks.pageGet).toHaveBeenCalledTimes(1);
  });

  it('keeps token and share-password reads outside the ordinary Page response cache', async () => {
    const { getPageMetadataDocument } = await import('./metadata');
    const { getPageView, getPageViewWithToken } = await import('./page');
    await getPageMetadataDocument('about', { requestedLocale: 'en' });
    await getPageView('about', { requestedLocale: 'en' });
    await getPageViewWithToken('about', 'first-token', 'en', ' first-password ');
    await getPageViewWithToken('about', 'second-token', 'en', 'second-password');

    expect(mocks.pageGet.mock.calls).toEqual([
      [{ slug: 'about' }],
      [{ slug: 'about', shareToken: 'first-token', sharePassword: 'first-password' }],
      [{ slug: 'about', shareToken: 'second-token', sharePassword: 'second-password' }],
    ]);
  });

  it('reads a fresh response after the React request cache scope changes', async () => {
    const { getPageMetadataDocument } = await import('./metadata');
    const { getPageView } = await import('./page');
    await getPageMetadataDocument('about', { requestedLocale: 'en' });
    await getPageView('about', { requestedLocale: 'en' });
    expect(mocks.pageGet).toHaveBeenCalledTimes(1);

    // The React cache mock models the renderer invalidating all caches at a
    // request boundary, while keeping the imported query modules unchanged.
    mocks.requestId += 1;
    mocks.pageGet.mockResolvedValue({ page: { id: 'about', title: 'Updated', status: PageStatus.PUBLISHED } });
    expect(await getPageMetadataDocument('about', { requestedLocale: 'en' })).toMatchObject({ title: 'Updated' });
    expect(await getPageView('about', { requestedLocale: 'en' })).toMatchObject({ title: 'Updated' });
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
