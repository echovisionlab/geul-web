import { fromJson } from '@bufbuild/protobuf';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentContentHeight, DocumentRegionPlacement } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { LocalizedPageDocumentSchema } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { PageStatus as PublicPageStatus } from '@echovisionlab/geul-proto/public/page_pb.ts';
import { createPageClient, createPublicPageClientWithAuth } from '@/lib/api/server-client';
import { getPage, getPageView, getPageViewWithToken } from './page';

const getPublicPageRpcMock = vi.fn();
const getAdminPageRpcMock = vi.fn();

const protoDocumentLayout = {
  contentHeight: DocumentContentHeight.VIEWPORT,
  pageChrome: DocumentRegionPlacement.PINNED,
  footer: DocumentRegionPlacement.FLOW,
};

vi.mock('@/lib/api/server-client', () => ({
  createPageClient: vi.fn(),
  createPublicPageClientWithAuth: vi.fn(),
}));

vi.mock('@/lib/queries/localized-public', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/queries/localized-public')>();
  return { ...actual, mapPublicLocalizationInfo: vi.fn((value) => value) };
});

const sectionId = '019cd13a-3716-79af-8490-dbd124708824';
const blockId = '019cd13a-3716-79af-8490-dbd124708825';

function localizedPageDocument(locale = 'ko', id = sectionId) {
  return fromJson(LocalizedPageDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    locale,
    base: {
      nodes: [
        {
          section: {
            id,
            richText: {
              props: {},
              blocks: {
                nodes: [{ block: { id: blockId, paragraph: { props: {} } }, placement: { index: 0 } }],
              },
            },
          },
          placement: { index: 0 },
        },
      ],
    },
    localeOverlay: {
      locale,
      sections: [
        {
          sectionId: id,
          richText: {
            props: {},
            blocks: {
              locale,
              blocks: [
                {
                  blockId,
                  paragraph: { props: {}, content: [{ text: { text: `${locale} content` } }] },
                },
              ],
            },
          },
        },
      ],
    },
  });
}

describe('public page queries', () => {
  beforeEach(() => {
    getAdminPageRpcMock.mockReset();
    getPublicPageRpcMock.mockReset();
    vi.mocked(createPageClient).mockReset();
    vi.mocked(createPageClient).mockResolvedValue({
      getPage: getAdminPageRpcMock,
      getPageBySlug: getAdminPageRpcMock,
    } as unknown as Awaited<ReturnType<typeof createPageClient>>);
    vi.mocked(createPublicPageClientWithAuth).mockReset();
    vi.mocked(createPublicPageClientWithAuth).mockResolvedValue({
      get: getPublicPageRpcMock,
    } as unknown as Awaited<ReturnType<typeof createPublicPageClientWithAuth>>);
  });

  it('materializes the generated localized Page document and Block media', async () => {
    const blockMedia: never[] = [];
    getPublicPageRpcMock.mockResolvedValue({
      page: {
        id: 'page-1',
        slug: 'about',
        title: 'About',
        featuredImageDelivery: {
          thumbnail: { url: 'https://cdn.example/page-thumbnail.webp' },
        },
        showTitle: true,
        document: localizedPageDocument(),
        documentLayout: protoDocumentLayout,
        localizationInfo: { displayedLocale: 'ko' },
      },
      blockMedia,
    });

    const page = await getPageView('about', { requestedLocale: 'ko' });

    expect(getPublicPageRpcMock).toHaveBeenCalledWith({ slug: 'about' });
    expect(page?.content).toMatchObject([{ id: sectionId, kind: 'rich-text' }]);
    expect(page?.blockMedia).toBe(blockMedia);
    expect(page?.featuredImageUrl).toBe('https://cdn.example/page-thumbnail.webp');
    expect(page?.documentLayout).toEqual({
      contentHeight: 'viewport',
      pageChrome: 'pinned',
      footer: 'flow',
    });
  });

  it('threads the share token through the generated document request', async () => {
    getPublicPageRpcMock.mockResolvedValue({
      page: {
        id: 'page-draft',
        slug: 'draft',
        title: 'Draft',
        featuredImageDelivery: {
          asset: { url: 'https://signed.example/page-asset.webp' },
        },
        showTitle: false,
        document: localizedPageDocument('en'),
        documentLayout: protoDocumentLayout,
        localizationInfo: { displayedLocale: 'en' },
      },
      blockMedia: [],
    });

    const page = await getPageViewWithToken('draft', 'share-token', 'en', 'secret');

    expect(getPublicPageRpcMock).toHaveBeenCalledWith({
      slug: 'draft',
      shareToken: 'share-token',
      sharePassword: 'secret',
    });
    expect(page).toMatchObject({
      featuredImageUrl: 'https://signed.example/page-asset.webp',
      content: [{ id: sectionId, kind: 'rich-text' }],
      documentLayout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' },
    });
  });

  it('returns the authoritative typed document for draft and published responses', async () => {
    getPublicPageRpcMock.mockResolvedValue({
      page: {
        id: 'page-draft',
        slug: 'draft',
        title: 'Draft',
        status: PublicPageStatus.DRAFT,
        showTitle: false,
        document: localizedPageDocument(),
      },
      blockMedia: [],
    });

    await expect(getPageView('draft')).resolves.toMatchObject({ content: [{ id: sectionId }] });

    getPublicPageRpcMock.mockResolvedValue({
      page: {
        id: 'page-published',
        slug: 'published',
        title: 'Published',
        status: PublicPageStatus.PUBLISHED,
        showTitle: true,
        document: localizedPageDocument(),
      },
      blockMedia: [],
    });
    await expect(getPageView('published')).resolves.toMatchObject({ content: [{ id: sectionId }] });
  });

  it('maps the root layout on the admin DTO', async () => {
    getAdminPageRpcMock.mockResolvedValue({
      id: 'page-1',
      title: 'Page',
      status: 1,
      showTitle: true,
      documentLayout: protoDocumentLayout,
      featuredImageDelivery: {
        thumbnail: { url: 'https://signed.example/editor-thumbnail.webp' },
      },
    });

    await expect(getPage('page-1')).resolves.toMatchObject({
      id: 'page-1',
      featuredImageUrl: 'https://signed.example/editor-thumbnail.webp',
      documentLayout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' },
    });
  });

  it('switches to the source locale body without deriving layout from either body', async () => {
    const localizedSectionId = '019cd13a-3716-79af-8490-dbd124708826';
    const sourceSectionId = '019cd13a-3716-79af-8490-dbd124708827';
    getPublicPageRpcMock
      .mockResolvedValueOnce({
        page: {
          id: 'page-1',
          slug: 'about',
          title: 'About',
          showTitle: true,
          document: localizedPageDocument('en', localizedSectionId),
          documentLayout: protoDocumentLayout,
          localizationInfo: { sourceLocale: 'ko', displayedLocale: 'en' },
        },
      })
      .mockResolvedValueOnce({
        page: {
          id: 'page-1',
          slug: 'about',
          title: 'About',
          showTitle: true,
          document: localizedPageDocument('ko', sourceSectionId),
          documentLayout: protoDocumentLayout,
          localizationInfo: { sourceLocale: 'ko', displayedLocale: 'ko' },
        },
      });
    await expect(getPageView('about', { requestedLocale: 'en', preferSourceLocale: true })).resolves.toMatchObject({
      content: [{ id: sourceSectionId }],
      documentLayout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' },
    });
    expect(createPublicPageClientWithAuth).toHaveBeenNthCalledWith(1, 'en');
    expect(createPublicPageClientWithAuth).toHaveBeenNthCalledWith(2, 'ko');
  });
});
