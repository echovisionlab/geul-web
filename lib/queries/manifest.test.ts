import { Code, ConnectError } from '@connectrpc/connect';
import { DocumentContentHeight, DocumentRegionPlacement } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createManifestClient,
  createPublicManifestClient,
  createPublicPageClientWithAuth,
} from '@/lib/api/server-client';
import { materializeLocalizedPageSections } from '@/features/editor/contract/localized-page';

const getManifestRpcMock = vi.fn();
const getPublicManifestRpcMock = vi.fn();
const getPublicPageRpcMock = vi.fn();

vi.mock('@/lib/api/server-client', () => ({
  createManifestClient: vi.fn(),
  createPublicManifestClient: vi.fn(),
  createPublicPageClient: vi.fn(),
  createPublicPageClientWithAuth: vi.fn(),
}));

vi.mock('@/lib/queries/localized-public', () => ({
  mapPublicLocalizationInfo: vi.fn((value) => value),
}));

vi.mock('@/features/editor/contract/localized-page', () => ({
  materializeLocalizedPageSections: vi.fn(),
}));

describe('getManifest', () => {
  beforeEach(() => {
    vi.resetModules();
    getManifestRpcMock.mockReset();
    getPublicManifestRpcMock.mockReset();
    getPublicPageRpcMock.mockReset();

    vi.mocked(createManifestClient).mockReset();
    vi.mocked(createManifestClient).mockResolvedValue({
      get: getManifestRpcMock,
    } as unknown as Awaited<ReturnType<typeof createManifestClient>>);

    vi.mocked(createPublicManifestClient).mockReset();
    vi.mocked(createPublicManifestClient).mockReturnValue({
      get: getPublicManifestRpcMock,
    } as unknown as ReturnType<typeof createPublicManifestClient>);

    vi.mocked(createPublicPageClientWithAuth).mockReset();
    vi.mocked(createPublicPageClientWithAuth).mockResolvedValue({
      get: getPublicPageRpcMock,
    } as unknown as Awaited<ReturnType<typeof createPublicPageClientWithAuth>>);
    vi.mocked(materializeLocalizedPageSections).mockReset();

    getManifestRpcMock.mockResolvedValue({
      settings: {
        siteTitle: 'Example Studio',
        siteOrigin: 'https://studio.example.com',
        socialLinks: {},
      },
      menus: {
        header: [{ id: 'home', label: 'Home' }],
      },
    });
    getPublicManifestRpcMock.mockResolvedValue({
      settings: {
        siteTitle: 'Public Example Studio',
        siteOrigin: 'https://public.example.com',
        socialLinks: {},
      },
      menus: {
        header: [{ id: 'public-home', label: 'Public Home' }],
      },
    });
  });

  it('passes the resolved locale to the authenticated manifest client', async () => {
    const { getManifest } = await import('./manifest');

    const manifest = await getManifest({ requestedLocale: 'en' });

    expect(createManifestClient).toHaveBeenCalledWith('en');
    expect(manifest.menus.header[0]?.label).toBe('Home');
  });

  it('passes the resolved locale to the public fallback manifest client', async () => {
    getManifestRpcMock.mockRejectedValueOnce(new ConnectError('unauthenticated', Code.Unauthenticated));
    const { getManifest } = await import('./manifest');

    const manifest = await getManifest({ requestedLocale: 'ja' });

    expect(createManifestClient).toHaveBeenCalledWith('ja');
    expect(createPublicManifestClient).toHaveBeenCalledWith('ja');
    expect(manifest.menus.header[0]?.label).toBe('Public Home');
  });

  it('passes the resolved locale through settings-only manifest reads', async () => {
    getManifestRpcMock.mockResolvedValueOnce({
      settings: {
        siteTitle: 'Example Studio',
        siteOrigin: 'https://studio.example.com',
        legalEmail: 'legal@example.com',
        supportEmail: 'support@example.com',
        privacyEmail: 'privacy@example.com',
        socialLinks: {},
      },
    });
    const { getSettings } = await import('./manifest');

    const settings = await getSettings({ requestedLocale: 'ko' });

    expect(createManifestClient).toHaveBeenCalledWith('ko');
    expect(settings.site_title).toBe('Example Studio');
    expect(settings.site_origin).toBe('https://studio.example.com');
    expect(settings.legal_email).toBe('legal@example.com');
    expect(settings.support_email).toBe('support@example.com');
    expect(settings.privacy_email).toBe('privacy@example.com');
    expect(settings).not.toHaveProperty('site_url');
  });

  it('uses only manifest site_origin for the manage site context', async () => {
    getManifestRpcMock.mockResolvedValueOnce({
      settings: {
        siteTitle: 'Example Studio',
        siteOrigin: '  https://studio.example.com/path/  ',
        socialLinks: {},
      },
    });
    const { getManageSiteContext } = await import('./manifest');

    await expect(getManageSiteContext()).resolves.toEqual({
      siteName: 'Example Studio',
      canonicalOrigin: 'https://studio.example.com/path',
    });
  });

  it('fails closed when manifest site_origin is absent', async () => {
    getManifestRpcMock.mockResolvedValueOnce({
      settings: {
        siteTitle: 'Example Studio',
        siteOrigin: '',
        socialLinks: {},
      },
    });
    const { getManageSiteContext } = await import('./manifest');

    await expect(getManageSiteContext()).rejects.toThrow('Manifest site_origin is required');
  });

  it('passes the resolved locale to public settings reads', async () => {
    const { getPublicSettings } = await import('./manifest');

    const settings = await getPublicSettings({ requestedLocale: 'zh-CN' });

    expect(createPublicManifestClient).toHaveBeenCalledWith('zh-CN');
    expect(settings.site_title).toBe('Public Example Studio');
    expect(settings.site_origin).toBe('https://public.example.com');
  });

  it('maps a complete favicon asset set to explicit versioned URLs', async () => {
    getPublicManifestRpcMock.mockResolvedValueOnce({
      settings: {
        siteTitle: 'Public Example Studio',
        socialLinks: {},
        faviconAsset: { url: 'https://cdn.example.com/asset/png32/favicon.png' },
        faviconAssetSet: {
          iconIco: { url: 'https://cdn.example.com/asset/favicon/favicon.ico' },
          iconPng16: { url: 'https://cdn.example.com/asset/png16/favicon.png' },
          iconPng32: { url: 'https://cdn.example.com/asset/png32/favicon.png' },
          iconPng48: { url: 'https://cdn.example.com/asset/png48/favicon.png' },
          appleTouchIcon180: { url: 'https://cdn.example.com/asset/apple180/favicon.png' },
          manifestIcon192: { url: 'https://cdn.example.com/asset/manifest192/favicon.png' },
          manifestIcon512: { url: 'https://cdn.example.com/asset/manifest512/favicon.png' },
          iconSvg: { url: 'https://cdn.example.com/asset/favicon/favicon.svg' },
        },
      },
    });
    const { getPublicSettings } = await import('./manifest');

    const settings = await getPublicSettings();

    expect(settings.favicon_url).toBe('https://cdn.example.com/asset/png32/favicon.png');
    expect(settings.favicon_asset_set).toEqual({
      icon_ico_url: 'https://cdn.example.com/asset/favicon/favicon.ico',
      icon_png_16_url: 'https://cdn.example.com/asset/png16/favicon.png',
      icon_png_32_url: 'https://cdn.example.com/asset/png32/favicon.png',
      icon_png_48_url: 'https://cdn.example.com/asset/png48/favicon.png',
      apple_touch_icon_180_url: 'https://cdn.example.com/asset/apple180/favicon.png',
      manifest_icon_192_url: 'https://cdn.example.com/asset/manifest192/favicon.png',
      manifest_icon_512_url: 'https://cdn.example.com/asset/manifest512/favicon.png',
      icon_svg_url: 'https://cdn.example.com/asset/favicon/favicon.svg',
    });
  });

  it('keeps the legacy favicon only when no generated asset set is present', async () => {
    getPublicManifestRpcMock.mockResolvedValueOnce({
      settings: {
        siteTitle: 'Public Example Studio',
        socialLinks: {},
        faviconAsset: { url: 'https://cdn.example.com/asset/legacy/favicon.png' },
      },
    });
    const { getPublicSettings } = await import('./manifest');

    const settings = await getPublicSettings();

    expect(settings.favicon_url).toBe('https://cdn.example.com/asset/legacy/favicon.png');
    expect(settings.favicon_asset_set).toBeNull();
  });

  it('omits an incomplete generated asset set instead of emitting broken links', async () => {
    getPublicManifestRpcMock.mockResolvedValueOnce({
      settings: {
        siteTitle: 'Public Example Studio',
        socialLinks: {},
        faviconAsset: { url: 'https://cdn.example.com/asset/png32/favicon.png' },
        faviconAssetSet: {
          iconIco: { url: 'https://cdn.example.com/asset/favicon/favicon.ico' },
          iconPng16: { url: 'https://cdn.example.com/asset/png16/favicon.png' },
          iconPng32: { url: 'https://cdn.example.com/asset/png32/favicon.png' },
        },
      },
    });
    const { getPublicSettings } = await import('./manifest');

    const settings = await getPublicSettings();

    expect(settings.favicon_url).toBeNull();
    expect(settings.favicon_asset_set).toBeNull();
  });

  it('materializes homepage content from the typed Page document', async () => {
    const document = { $typeName: 'api.content.v1.LocalizedPageDocument' } as never;
    const content = [{ id: 'scene', kind: 'immersive-scene' }] as never;
    const blockMedia: never[] = [];
    getPublicPageRpcMock.mockResolvedValue({
      page: {
        id: 'page-1',
        title: 'Home',
        featuredImageDelivery: {
          thumbnail: { url: 'https://cdn.example/home-thumbnail.webp' },
        },
        slug: '',
        showTitle: false,
        document,
        documentLayout: {
          contentHeight: DocumentContentHeight.VIEWPORT,
          pageChrome: DocumentRegionPlacement.PINNED,
          footer: DocumentRegionPlacement.FLOW,
        },
        localizationInfo: { displayedLocale: 'ko' },
      },
      blockMedia,
    });
    vi.mocked(materializeLocalizedPageSections).mockReturnValue(content);
    const { getPublicPage } = await import('./manifest');

    const page = await getPublicPage('/', { requestedLocale: 'ko' });

    expect(createPublicPageClientWithAuth).toHaveBeenCalledWith('ko');
    expect(materializeLocalizedPageSections).toHaveBeenCalledWith(document);
    expect(page?.content).toBe(content);
    expect(page?.blockMedia).toBe(blockMedia);
    expect(page?.featuredImageUrl).toBe('https://cdn.example/home-thumbnail.webp');
    expect(page?.documentLayout).toEqual({
      contentHeight: 'viewport',
      pageChrome: 'pinned',
      footer: 'flow',
    });
  });
});
