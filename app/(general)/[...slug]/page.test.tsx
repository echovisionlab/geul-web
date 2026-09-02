import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicPageView from './page';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getPage: vi.fn(),
  getPageMetadataDocument: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
  listEntityTranslations: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));
vi.mock('@/lib/utils/session.server', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/queries/page', () => ({ getPage: mocks.getPage }));
vi.mock('@/lib/api/server-client', () => ({
  createTranslationClient: vi.fn(async () => ({
    listEntityTranslations: mocks.listEntityTranslations,
  })),
}));
vi.mock('@/lib/queries/manifest', () => ({
  getManageSiteContext: vi.fn(async () => ({ canonicalOrigin: 'https://example.test', siteName: 'Geul' })),
}));
vi.mock('@/lib/queries/metadata', () => ({
  getPageMetadataDocument: mocks.getPageMetadataDocument,
  getSiteMetadataDocument: vi.fn(),
}));
vi.mock('@/lib/utils/language.server', () => ({ getUserLocale: vi.fn(async () => 'en') }));
vi.mock('@/lib/utils/url.server', () => ({ getBaseUrl: vi.fn(async () => 'https://example.test') }));
vi.mock('@/features/page/PageEditor/PageEditor', () => ({ PageEditor: vi.fn(() => null) }));
vi.mock('./PageContent', () => ({ PageContent: vi.fn(() => null) }));
vi.mock('./PageContentWithToken', () => ({ PageContentWithToken: vi.fn(() => null) }));

const page = {
  id: 'page-uuid',
  title: 'Page title',
  summary: null,
  slug: 'edit',
  status: 'draft',
  showTitle: true,
  documentLayout: { contentHeight: 'content', pageChrome: 'flow', footer: 'flow' },
  featuredImageUrl: null,
  ogImageUrl: null,
};

const PLURAL_NAMESPACE_PAGE_SLUGS = ['posts', 'works', 'artists', 'releases', 'labels', 'forms', 'events'] as const;

function props(slug: string, searchParams: Record<string, string | string[] | undefined> = { edit: 'true' }) {
  return {
    params: Promise.resolve({ slug: slug.split('/') }),
    searchParams: Promise.resolve(searchParams),
  };
}

describe('Page view and editor route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
      user: { id: 'member-1', nickname: 'Admin', role: 'admin' },
    });
    mocks.getPage.mockResolvedValue(page);
    mocks.getPageMetadataDocument.mockResolvedValue(null);
    mocks.listEntityTranslations.mockResolvedValue({ sourceLocale: 'en', entries: [] });
  });

  it('redirects no Session to login with the exact edit=true return path before entity lookup', async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(PublicPageView(props('edit', { edit: 'true', lang: 'ko' }))).rejects.toThrow(
      'redirect:/login?redirect=%2Fedit%3Fedit%3Dtrue%26lang%3Dko',
    );
    expect(mocks.getPage).not.toHaveBeenCalled();
  });

  it('returns not found for an authenticated non-admin without revealing Page existence', async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: 'member-1', nickname: 'Member', role: 'member' },
    });

    await expect(PublicPageView(props('edit'))).rejects.toThrow('not-found');
    expect(mocks.getPage).not.toHaveBeenCalled();
  });

  it('returns not found for a missing Page after authenticating an admin', async () => {
    mocks.getPage.mockResolvedValue(null);

    await expect(PublicPageView(props('missing'))).rejects.toThrow('not-found');
    expect(mocks.getPage).toHaveBeenCalledWith('missing');
  });

  it('accepts a valid Page slug as a legacy editor URL and canonicalizes it to the immutable ID', async () => {
    await expect(PublicPageView(props('edit'))).rejects.toThrow('redirect:/page-uuid?edit=true');
    expect(mocks.getPage).toHaveBeenCalledWith('edit');
  });

  it('serves the editor at the immutable ID while preserving edit=true and locale', async () => {
    const result = await PublicPageView(props('page-uuid', { edit: 'true', lang: 'ko' }));

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(result.props).toMatchObject({
      pageId: 'page-uuid',
      initialSlug: 'edit',
      canManageTranslations: true,
    });
  });

  it('joins nested segments for read and edit without encoding the separator', async () => {
    mocks.getPage.mockResolvedValue({ ...page, slug: 'some/where' });

    await expect(PublicPageView(props('some/where'))).rejects.toThrow('redirect:/page-uuid?edit=true');
    expect(mocks.getPage).toHaveBeenCalledWith('some/where');

    const readResult = await PublicPageView(props('some/where', {}));
    expect(readResult.props.children[1].props.slug).toBe('some/where');
  });

  it('uses the immutable ID URL when an editable Page has no slug', async () => {
    mocks.getPage.mockResolvedValue({ ...page, slug: null });

    const result = await PublicPageView(props('page-uuid'));

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(result.props).toMatchObject({ pageId: 'page-uuid', initialSlug: null });
  });

  it('keeps the same route in read mode when edit is absent', async () => {
    const result = await PublicPageView(props('edit', {}));

    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.getPage).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it.each(PLURAL_NAMESPACE_PAGE_SLUGS)('keeps /%s available as a Page slug', async (slug) => {
    const readResult = await PublicPageView(props(slug, {}));
    expect(readResult.props.children[1].props.slug).toBe(slug);

    mocks.getPage.mockResolvedValue({ ...page, slug });
    await expect(PublicPageView(props(slug))).rejects.toThrow('redirect:/page-uuid?edit=true');
  });
});
