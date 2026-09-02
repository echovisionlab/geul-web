import { FormStatus } from '@echovisionlab/geul-proto/public/form_pb.ts';
import { PageStatus } from '@echovisionlab/geul-proto/public/page_pb.ts';
import { PostStatus } from '@echovisionlab/geul-proto/public/post_pb.ts';
import { WorkStatus } from '@echovisionlab/geul-proto/public/work_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createManifestClient,
  createPublicFormClientWithAuth,
  createPublicMemberClient,
  createPublicPageClientWithAuth,
  createPublicPostClientWithAuth,
  createPublicReleaseClientWithAuth,
  createPublicWorkClientWithAuth,
} from '@/lib/api/server-client';
import { assetRefFixture } from '@/tests/helpers/asset-ref';

const getManifestRpcMock = vi.fn();
const getPublicPageRpcMock = vi.fn();
const getPublicPostRpcMock = vi.fn();
const getPublicReleaseRpcMock = vi.fn();
const getPublicWorkRpcMock = vi.fn();
const checkFormAccessRpcMock = vi.fn();
const getPublicMemberRpcMock = vi.fn();

vi.mock('@/lib/api/server-client', () => ({
  createManifestClient: vi.fn(),
  createPublicArtistClientWithAuth: vi.fn(),
  createPublicFormClientWithAuth: vi.fn(),
  createPublicLabelClientWithAuth: vi.fn(),
  createPublicPageClientWithAuth: vi.fn(),
  createPublicPostClientWithAuth: vi.fn(),
  createPublicReleaseClientWithAuth: vi.fn(),
  createPublicMemberClient: vi.fn(),
  createPublicWorkClientWithAuth: vi.fn(),
}));

vi.mock('@/lib/logging/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('getWorkMetadataDocument', () => {
  beforeEach(() => {
    getManifestRpcMock.mockReset();
    getPublicWorkRpcMock.mockReset();

    vi.mocked(createManifestClient).mockReset();
    vi.mocked(createManifestClient).mockResolvedValue({
      get: getManifestRpcMock,
    } as unknown as Awaited<ReturnType<typeof createManifestClient>>);
    vi.mocked(createPublicWorkClientWithAuth).mockReset();
    vi.mocked(createPublicWorkClientWithAuth).mockResolvedValue({
      get: getPublicWorkRpcMock,
    } as unknown as Awaited<ReturnType<typeof createPublicWorkClientWithAuth>>);

    getManifestRpcMock.mockResolvedValue({
      settings: {
        siteTitle: 'Example Studio',
        siteOrigin: 'https://studio.example.com',
        siteOgAsset: assetRefFixture('https://cdn.example.test/asset/site-og.webp'),
        socialLinks: {},
      },
    });
  });

  it('keeps archived Work metadata public while draft Work metadata stays hidden', async () => {
    const { getWorkMetadataDocument } = await import('./metadata');
    getPublicWorkRpcMock.mockResolvedValue({
      work: {
        id: 'work-1',
        status: WorkStatus.ARCHIVED,
        slug: 'archived-work',
        title: 'Archived Work',
        featuredImageAsset: assetRefFixture('https://cdn.example.test/asset/work-featured.webp'),
        ogAsset: assetRefFixture('https://cdn.example.test/asset/work-og.webp'),
        credits: [],
      },
    });

    await expect(getWorkMetadataDocument('archived-work', { requestedLocale: 'en' })).resolves.toMatchObject({
      id: 'work-1',
      routePath: '/works/archived-work',
      title: 'Archived Work',
      featuredImageUrl: 'https://cdn.example.test/asset/work-featured.webp',
      ogImageUrl: 'https://cdn.example.test/asset/work-og.webp',
    });

    getPublicWorkRpcMock.mockResolvedValueOnce({
      work: {
        id: 'work-2',
        status: WorkStatus.DRAFT,
        title: 'Draft Work',
        credits: [],
      },
    });
    await expect(getWorkMetadataDocument('draft-work', { requestedLocale: 'en' })).resolves.toBeNull();
  });
});

describe('getReleaseMetadataDocument', () => {
  beforeEach(() => {
    getManifestRpcMock.mockReset();
    getPublicReleaseRpcMock.mockReset();

    vi.mocked(createManifestClient).mockReset();
    vi.mocked(createManifestClient).mockResolvedValue({
      get: getManifestRpcMock,
    } as unknown as Awaited<ReturnType<typeof createManifestClient>>);
    vi.mocked(createPublicReleaseClientWithAuth).mockReset();
    vi.mocked(createPublicReleaseClientWithAuth).mockResolvedValue({
      get: getPublicReleaseRpcMock,
    } as unknown as Awaited<ReturnType<typeof createPublicReleaseClientWithAuth>>);

    getManifestRpcMock.mockResolvedValue({
      settings: {
        siteTitle: 'Example Studio',
        siteOrigin: 'https://studio.example.com',
        siteOgAsset: assetRefFixture('https://cdn.example.test/asset/site-og.webp'),
        socialLinks: {},
      },
    });
  });

  it('uses Release artwork directly for every locale and ignores a stale generated OG asset', async () => {
    const { getReleaseMetadataDocument } = await import('./metadata');
    getPublicReleaseRpcMock.mockResolvedValue({
      release: {
        id: 'release-1',
        title: 'Source Release Title',
        slug: 'source-release',
        type: 1,
        artists: [],
        artworkAsset: assetRefFixture('https://cdn.example.test/asset/release-artwork.webp'),
        ogAsset: assetRefFixture('https://cdn.example.test/asset/stale-generated-og.webp'),
      },
    });

    await expect(getReleaseMetadataDocument('source-release', { requestedLocale: 'ko' })).resolves.toMatchObject({
      artworkUrl: 'https://cdn.example.test/asset/release-artwork.webp',
      ogImageUrl: 'https://cdn.example.test/asset/release-artwork.webp',
      site: {
        siteOgImageUrl: 'https://cdn.example.test/asset/site-og.webp',
      },
    });
    expect(createPublicReleaseClientWithAuth).toHaveBeenCalledWith('ko');
  });

  it('does not expose a stale generated OG when artwork is absent', async () => {
    const { getReleaseMetadataDocument } = await import('./metadata');
    getPublicReleaseRpcMock.mockResolvedValue({
      release: {
        id: 'release-1',
        title: 'Release Without Artwork',
        type: 1,
        artists: [],
        ogAsset: assetRefFixture('https://cdn.example.test/asset/stale-generated-og.webp'),
      },
    });

    await expect(getReleaseMetadataDocument('release-1', { requestedLocale: 'en' })).resolves.toMatchObject({
      artworkUrl: null,
      ogImageUrl: null,
      site: {
        siteOgImageUrl: 'https://cdn.example.test/asset/site-og.webp',
      },
    });
  });
});

describe('getFormMetadataDocument', () => {
  beforeEach(() => {
    getManifestRpcMock.mockReset();
    checkFormAccessRpcMock.mockReset();

    vi.mocked(createManifestClient).mockReset();
    vi.mocked(createManifestClient).mockResolvedValue({
      get: getManifestRpcMock,
    } as unknown as Awaited<ReturnType<typeof createManifestClient>>);
    vi.mocked(createPublicFormClientWithAuth).mockReset();
    vi.mocked(createPublicFormClientWithAuth).mockResolvedValue({
      checkAccess: checkFormAccessRpcMock,
    } as unknown as Awaited<ReturnType<typeof createPublicFormClientWithAuth>>);

    getManifestRpcMock.mockResolvedValue({
      settings: {
        siteTitle: 'Example Studio',
        siteOrigin: 'https://studio.example.com',
        siteOgAsset: assetRefFixture('https://cdn.example.test/asset/site-og.webp'),
        socialLinks: {},
      },
    });
  });

  it('keeps generated and featured Form images as separate metadata fallbacks', async () => {
    const { getFormMetadataDocument } = await import('./metadata');
    checkFormAccessRpcMock.mockResolvedValue({
      form: {
        id: 'form-1',
        status: FormStatus.PUBLISHED,
        title: 'Localized Form',
        slug: 'survey',
        ogAsset: assetRefFixture('https://cdn.example.test/asset/form-generated.webp'),
        featuredImageAsset: assetRefFixture('https://images.example.test/form-featured.webp'),
        localizationInfo: {
          requestedLocale: 'ko',
          displayedLocale: 'ko',
          sourceLocale: 'en',
          availableLocales: ['en', 'ko'],
        },
      },
    });

    await expect(getFormMetadataDocument('survey', { requestedLocale: 'ko' })).resolves.toMatchObject({
      id: 'form-1',
      title: 'Localized Form',
      ogImageUrl: 'https://cdn.example.test/asset/form-generated.webp',
      featuredImageUrl: 'https://images.example.test/form-featured.webp',
      localizationInfo: {
        displayedLocale: 'ko',
      },
    });
    expect(createPublicFormClientWithAuth).toHaveBeenCalledWith('ko');
  });
});

describe('getMemberMetadataDocument', () => {
  beforeEach(() => {
    getManifestRpcMock.mockReset();
    getPublicMemberRpcMock.mockReset();

    vi.mocked(createManifestClient).mockReset();
    vi.mocked(createManifestClient).mockResolvedValue({
      get: getManifestRpcMock,
    } as unknown as Awaited<ReturnType<typeof createManifestClient>>);
    vi.mocked(createPublicMemberClient).mockReset();
    vi.mocked(createPublicMemberClient).mockReturnValue({
      getPublicMember: getPublicMemberRpcMock,
    } as unknown as ReturnType<typeof createPublicMemberClient>);

    getManifestRpcMock.mockResolvedValue({
      settings: {
        siteTitle: 'Example Studio',
        siteOrigin: 'https://studio.example.com',
        socialLinks: {},
      },
    });
  });

  it('uses the actual public user route for canonical and Open Graph metadata', async () => {
    const { getMemberMetadataDocument } = await import('./metadata');
    getPublicMemberRpcMock.mockResolvedValue({
      member: {
        summary: {
          id: 'member-1',
          nickname: 'Member',
        },
      },
    });

    await expect(getMemberMetadataDocument('member-1')).resolves.toMatchObject({
      routePath: '/user/member-1',
    });
  });
});

describe('getHomeMetadataDocument', () => {
  beforeEach(() => {
    getManifestRpcMock.mockReset();
    getPublicPageRpcMock.mockReset();
    getPublicPostRpcMock.mockReset();

    vi.mocked(createManifestClient).mockReset();
    vi.mocked(createManifestClient).mockResolvedValue({
      get: getManifestRpcMock,
    } as unknown as Awaited<ReturnType<typeof createManifestClient>>);

    vi.mocked(createPublicPageClientWithAuth).mockReset();
    vi.mocked(createPublicPageClientWithAuth).mockResolvedValue({
      get: getPublicPageRpcMock,
    } as unknown as Awaited<ReturnType<typeof createPublicPageClientWithAuth>>);

    vi.mocked(createPublicPostClientWithAuth).mockReset();
    vi.mocked(createPublicPostClientWithAuth).mockResolvedValue({
      get: getPublicPostRpcMock,
    } as unknown as Awaited<ReturnType<typeof createPublicPostClientWithAuth>>);

    getManifestRpcMock.mockResolvedValue({
      settings: {
        siteTitle: 'Example Studio',
        metaDescription: 'Site description',
        siteOrigin: 'https://studio.example.com',
        siteOgAsset: assetRefFixture('https://cdn.example.test/asset/site-og-asset/og.webp'),
        companyName: 'Example Studio',
        logoLightAsset: assetRefFixture('https://cdn.example.test/logo.webp'),
        socialLinks: {},
      },
    });
  });

  it('prefers site-level homepage metadata over the root page metadata when both exist', async () => {
    const { getHomeMetadataDocument } = await import('./metadata');

    getPublicPageRpcMock.mockResolvedValue({
      page: {
        status: PageStatus.PUBLISHED,
        title: 'Root Page Title',
        summary: 'Root page summary',
        featuredImageDelivery: {
          thumbnail: assetRefFixture('https://cdn.example.test/page.webp'),
        },
        ogAsset: assetRefFixture('https://cdn.example.test/asset/page-og-asset/og.webp'),
      },
    });

    await expect(getHomeMetadataDocument({ requestedLocale: 'en' })).resolves.toMatchObject({
      routePath: '/',
      title: 'Example Studio',
      summary: 'Site description',
      featuredImageUrl: null,
      ogImageUrl: 'https://cdn.example.test/asset/site-og-asset/og.webp',
      site: {
        siteTitle: 'Example Studio',
        siteDescription: 'Site description',
        canonicalOrigin: 'https://studio.example.com',
      },
    });

    getPublicPageRpcMock.mockResolvedValue({
      page: {
        status: PageStatus.PUBLISHED,
        title: 'Translated Home',
        summary: 'Translated summary',
        localizationInfo: {
          requestedLocale: 'en',
          displayedLocale: 'en',
          sourceLocale: 'ko',
          machineGenerated: true,
          availableLocales: ['ko', 'en'],
        },
      },
    });
    await expect(getHomeMetadataDocument({ requestedLocale: 'en' })).resolves.toMatchObject({
      title: 'Translated Home',
      featuredImageUrl: null,
      ogImageUrl: null,
    });
  });

  it('falls back to the root page metadata when site-level homepage metadata is absent', async () => {
    const { getHomeMetadataDocument } = await import('./metadata');

    getManifestRpcMock.mockResolvedValue({
      settings: {
        siteTitle: '',
        metaDescription: '',
        siteOrigin: 'https://studio.example.com',
        siteOgAsset: undefined,
        companyName: 'Example Studio',
        logoLightAsset: assetRefFixture('https://cdn.example.test/logo.webp'),
        socialLinks: {},
      },
    });
    getPublicPageRpcMock.mockResolvedValue({
      page: {
        status: PageStatus.PUBLISHED,
        title: 'Root Page Title',
        summary: 'Root page summary',
        featuredImageDelivery: {
          thumbnail: assetRefFixture('https://cdn.example.test/page.webp'),
        },
        ogAsset: assetRefFixture('https://cdn.example.test/asset/page-og-asset/og.webp'),
      },
    });

    await expect(getHomeMetadataDocument({ requestedLocale: 'en' })).resolves.toMatchObject({
      routePath: '/',
      title: 'Root Page Title',
      summary: 'Root page summary',
      featuredImageUrl: 'https://cdn.example.test/page.webp',
      ogImageUrl: 'https://cdn.example.test/asset/page-og-asset/og.webp',
    });
  });

  it('keeps current root Page target text and exact target OG atomic instead of mixing Site source metadata', async () => {
    const { getHomeMetadataDocument } = await import('./metadata');

    getPublicPageRpcMock.mockResolvedValue({
      page: {
        status: PageStatus.PUBLISHED,
        title: 'Translated Home',
        summary: 'Translated summary',
        featuredImageDelivery: {
          thumbnail: assetRefFixture('https://cdn.example.test/source-page-featured.webp'),
        },
        ogAsset: assetRefFixture('https://cdn.example.test/exact-target-page-og.webp'),
        localizationInfo: {
          requestedLocale: 'en',
          displayedLocale: 'en',
          sourceLocale: 'ko',
          machineGenerated: true,
          availableLocales: ['ko', 'en'],
        },
      },
    });

    await expect(getHomeMetadataDocument({ requestedLocale: 'en' })).resolves.toMatchObject({
      title: 'Translated Home',
      summary: 'Translated summary',
      featuredImageUrl: null,
      ogImageUrl: 'https://cdn.example.test/exact-target-page-og.webp',
      localizationInfo: {
        requestedLocale: 'en',
        displayedLocale: 'en',
        sourceLocale: 'ko',
      },
    });
  });

  it('maps Page metadata from the entity-scoped featured image delivery', async () => {
    const { getPageMetadataDocument } = await import('./metadata');
    getPublicPageRpcMock.mockResolvedValue({
      page: {
        id: 'page-1',
        status: PageStatus.PUBLISHED,
        slug: 'about',
        title: 'About',
        summary: 'About summary',
        showTitle: true,
        featuredImageDelivery: {
          thumbnail: assetRefFixture('https://cdn.example.test/page-thumbnail.webp'),
          asset: assetRefFixture('https://signed.example.test/page-asset.webp'),
        },
      },
    });

    await expect(getPageMetadataDocument('about', { requestedLocale: 'en' })).resolves.toMatchObject({
      id: 'page-1',
      routePath: '/about',
      featuredImageUrl: 'https://cdn.example.test/page-thumbnail.webp',
    });
  });

  it('keeps archived Post metadata public while private Post metadata stays hidden', async () => {
    const { getPostMetadataDocument } = await import('./metadata');
    getPublicPostRpcMock.mockResolvedValue({
      post: {
        id: 'post-1',
        status: PostStatus.ARCHIVED,
        slug: 'archived-post',
        title: 'Archived Post',
        summary: 'Read-only public Post',
        authorMembers: [],
        categories: [],
        tags: [],
      },
    });

    await expect(getPostMetadataDocument('archived-post', { requestedLocale: 'en' })).resolves.toMatchObject({
      id: 'post-1',
      routePath: '/posts/archived-post',
      title: 'Archived Post',
    });

    getPublicPostRpcMock.mockResolvedValueOnce({
      post: {
        id: 'post-2',
        status: PostStatus.DRAFT,
        title: 'Draft Post',
        authorMembers: [],
        categories: [],
        tags: [],
      },
    });
    await expect(getPostMetadataDocument('draft-post', { requestedLocale: 'en' })).resolves.toBeNull();
  });

  it('fails closed when manifest settings are absent', async () => {
    const { getSiteMetadataDocument } = await import('./metadata');
    getManifestRpcMock.mockResolvedValueOnce({});

    await expect(getSiteMetadataDocument()).rejects.toThrow('Manifest settings are required for site metadata');
  });

  it('fails closed when manifest site_origin is absent', async () => {
    const { getSiteMetadataDocument } = await import('./metadata');
    getManifestRpcMock.mockResolvedValueOnce({
      settings: {
        siteTitle: 'Example Studio',
        siteOrigin: '',
        socialLinks: {},
      },
    });

    await expect(getSiteMetadataDocument()).rejects.toThrow('Manifest site_origin is required');
  });
});
