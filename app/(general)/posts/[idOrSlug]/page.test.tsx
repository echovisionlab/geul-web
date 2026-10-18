import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPostMetadataDocument: vi.fn(),
  getPostView: vi.fn(),
  getPostViewWithToken: vi.fn(),
  getUserLocale: vi.fn(),
  renderPageRouteFallback: vi.fn(),
  renderPostEditRoute: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(),
}));

vi.mock('@/features/metadata/ui/JsonLdScript', () => ({
  JsonLdScript: () => <div>json-ld</div>,
}));

vi.mock('@/features/site/PageLoader', () => ({
  PageLoader: () => <div>loading</div>,
}));

vi.mock('@/lib/queries/metadata', () => ({
  getPostMetadataDocument: mocks.getPostMetadataDocument,
  getSiteMetadataDocument: vi.fn(),
}));

vi.mock('@/lib/queries/post', () => ({
  getPostView: mocks.getPostView,
  getPostViewWithToken: mocks.getPostViewWithToken,
}));

vi.mock('@/lib/translation/content-language', () => ({
  resolveContentRequestedLocale: (_uiLocale: string, query: Record<string, unknown>) =>
    typeof query.lang === 'string' ? query.lang : 'ko',
}));

vi.mock('@/lib/translation/metadata', () => ({
  buildContentMetadataSeo: vi.fn(),
}));

vi.mock('@/lib/utils/json-ld', () => ({
  buildPostJsonLd: vi.fn(),
}));

vi.mock('@/lib/utils/language.server', () => ({
  getUserLocale: mocks.getUserLocale,
}));

vi.mock('@/lib/utils/og', () => ({
  buildPostOgMetadata: vi.fn(),
}));

vi.mock('@/lib/utils/route-metadata', () => ({
  withNoIndex: vi.fn(),
}));

vi.mock('@/lib/utils/url', () => ({
  joinUrl: vi.fn(),
}));

vi.mock('./PostContent', () => ({
  PostContent: ({ initialPost }: { initialPost: { id: string } }) => <div>public:{initialPost.id}</div>,
}));

vi.mock('./PostContentWithToken', () => ({
  PostContentWithToken: ({ initialPost }: { initialPost: { id: string; status: string } }) => (
    <div>
      shared:{initialPost.id}:{initialPost.status}
    </div>
  ),
}));

vi.mock('./PostEditRoute', () => ({
  generatePostEditMetadata: vi.fn(),
  renderPostEditRoute: mocks.renderPostEditRoute,
}));
vi.mock('@/app/_shared/page-route-fallback', () => ({
  generatePageRouteFallbackMetadata: vi.fn(),
  renderPageRouteFallback: mocks.renderPageRouteFallback,
}));

import PostViewPage from './page';

function renderPage(searchParams: Record<string, string | string[] | undefined> = {}) {
  return PostViewPage({
    params: Promise.resolve({ idOrSlug: 'post-slug' }),
    searchParams: Promise.resolve(searchParams),
  });
}

describe('PostViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserLocale.mockResolvedValue('ko');
    mocks.getPostMetadataDocument.mockResolvedValue(null);
    mocks.renderPageRouteFallback.mockReturnValue(<div>page-fallback</div>);
    mocks.notFound.mockImplementation(() => {
      throw new Error('notFound');
    });
  });

  it('falls back to the nested Page route for a missing public post', async () => {
    mocks.getPostView.mockResolvedValue(null);

    const html = renderToStaticMarkup(await renderPage());

    expect(html).toContain('page-fallback');
    expect(mocks.renderPageRouteFallback).toHaveBeenCalledWith(['posts', 'post-slug'], {});
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.getPostView).toHaveBeenCalledWith('post-slug', { requestedLocale: 'ko' });
    expect(mocks.getPostViewWithToken).not.toHaveBeenCalled();
  });

  it('renders the editor only for the literal edit=true query without a public lookup', async () => {
    mocks.renderPostEditRoute.mockResolvedValue(<div>editor</div>);

    const html = renderToStaticMarkup(await renderPage({ edit: 'true', lang: 'ko' }));

    expect(html).toContain('editor');
    expect(mocks.renderPostEditRoute).toHaveBeenCalledWith('post-slug', { edit: 'true', lang: 'ko' });
    expect(mocks.getPostView).not.toHaveBeenCalled();
    expect(mocks.getPostMetadataDocument).not.toHaveBeenCalled();
  });

  it('keeps edit=false in the existing public view', async () => {
    mocks.getPostView.mockResolvedValue({ id: 'post-1', status: 'published' });

    const html = renderToStaticMarkup(await renderPage({ edit: 'false' }));

    expect(html).toContain('public:post-1');
    expect(mocks.renderPostEditRoute).not.toHaveBeenCalled();
  });

  it.each(['published', 'draft', 'archived'])(
    'passes an accessible %s post into the pending-render boundary',
    async (status) => {
      mocks.getPostView.mockResolvedValue({ id: 'post-1', status });

      const html = renderToStaticMarkup(await renderPage());

      expect(html).toContain('public:post-1');
      expect(mocks.notFound).not.toHaveBeenCalled();
    },
  );

  it('falls back to the nested Page route for an invalid share token', async () => {
    mocks.getPostViewWithToken.mockResolvedValue(null);

    const html = renderToStaticMarkup(await renderPage({ share: 'invalid-token', lang: 'en' }));

    expect(html).toContain('page-fallback');
    expect(mocks.renderPageRouteFallback).toHaveBeenCalledWith(['posts', 'post-slug'], {
      share: 'invalid-token',
      lang: 'en',
    });
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.getPostViewWithToken).toHaveBeenCalledWith('post-slug', 'invalid-token', 'en');
    expect(mocks.getPostView).not.toHaveBeenCalled();
    expect(mocks.getPostMetadataDocument).not.toHaveBeenCalled();
  });

  it('keeps draft access for a valid share token', async () => {
    mocks.getPostViewWithToken.mockResolvedValue({ id: 'post-1', status: 'draft' });

    const html = renderToStaticMarkup(await renderPage({ share: 'valid-token' }));

    expect(html).toContain('shared:post-1:draft');
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it('propagates public lookup failures instead of converting them to not-found responses', async () => {
    const error = new Error('upstream connection closed');
    mocks.getPostView.mockRejectedValue(error);

    await expect(renderPage()).rejects.toBe(error);

    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
