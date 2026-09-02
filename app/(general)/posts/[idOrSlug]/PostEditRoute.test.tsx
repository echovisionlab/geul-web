import { renderToStaticMarkup } from 'react-dom/server';
import { PostAction } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getPostForEdit: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));
vi.mock('@/features/post/PostEditor/PostEditor', () => ({
  PostEditor: ({ postId, initialAllowedActions }: { postId: string; initialAllowedActions: PostAction[] }) => (
    <div>
      editor:{postId}:{initialAllowedActions.includes(PostAction.EDIT) ? 'edit' : 'view'}
    </div>
  ),
}));
vi.mock('@/lib/actions/category', () => ({ listCategoriesAction: vi.fn(async () => []) }));
vi.mock('@/lib/actions/post', () => ({ listPostShareLinksAction: vi.fn(async () => []) }));
vi.mock('@/lib/actions/tag', () => ({ listTagsAction: vi.fn(async () => []) }));
vi.mock('@/lib/queries/manifest', () => ({
  getManageSiteContext: vi.fn(async () => ({ canonicalOrigin: 'https://example.test', siteName: 'Geul' })),
  getSettings: vi.fn(),
}));
vi.mock('@/lib/queries/post', () => ({ getPostForEdit: mocks.getPostForEdit }));
vi.mock('@/lib/queries/series', () => ({
  listMySeries: vi.fn(async () => []),
  listSeriesSimple: vi.fn(async () => []),
}));
vi.mock('@/lib/utils/og', () => ({ buildStaticOgMetadata: vi.fn() }));
vi.mock('@/lib/utils/route-metadata', () => ({ withNoIndex: vi.fn() }));
vi.mock('@/lib/utils/session.server', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/utils/url.server', () => ({ getBaseUrl: vi.fn(async () => 'https://example.test') }));

import { renderPostEditRoute } from './PostEditRoute';

const POST_ID = '00000000-0000-4000-8000-000000000001';
const post = {
  id: POST_ID,
  title: 'Post',
  slug: 'post-slug',
  summary: null,
  status: 'draft',
  scheduledAt: null,
  scheduledTimeZone: null,
  allowedActions: [PostAction.EDIT],
  categories: [],
  tags: [],
  featuredImageUrl: null,
  commentsEnabled: true,
  documentLayout: { contentHeight: 'content', pageChrome: 'flow', footer: 'flow' },
  seriesId: null,
  seriesOrder: null,
  mapPlaceId: null,
  ogImageUrl: null,
};

describe('Post edit query route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: 'member-1', nickname: 'Member', role: 'author' } });
    mocks.getPostForEdit.mockResolvedValue(post);
  });

  it('redirects an anonymous request to login before looking up the Post', async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(renderPostEditRoute('private-post', { edit: 'true', lang: 'ko' })).rejects.toThrow(
      'redirect:/login?redirect=%2Fposts%2Fprivate-post%3Fedit%3Dtrue%26lang%3Dko',
    );
    expect(mocks.getPostForEdit).not.toHaveBeenCalled();
  });

  it('does not distinguish a missing Post from another not-found result', async () => {
    mocks.getPostForEdit.mockResolvedValue(null);

    await expect(renderPostEditRoute('hidden-post', { edit: 'true' })).rejects.toThrow('not-found');
  });

  it('hides a visible Post when the API did not grant the exact edit action', async () => {
    mocks.getPostForEdit.mockResolvedValue({ ...post, allowedActions: [PostAction.MANAGE_SHARE_LINKS] });

    await expect(renderPostEditRoute('post-slug', { edit: 'true' })).rejects.toThrow('not-found');
  });

  it('mounts the collaboration editor for an archived Author in read-only mode', async () => {
    mocks.getPostForEdit.mockResolvedValue({ ...post, status: 'archived', allowedActions: [] });

    const html = renderToStaticMarkup(await renderPostEditRoute(POST_ID, { edit: 'true' }));

    expect(html).toContain(`editor:${POST_ID}:view`);
  });

  it('mounts the existing editor for an archived Admin', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'member-1', nickname: 'Admin', role: 'admin' } });
    mocks.getPostForEdit.mockResolvedValue({ ...post, status: 'archived' });

    const html = renderToStaticMarkup(await renderPostEditRoute(POST_ID, { edit: 'true' }));

    expect(html).toContain(`editor:${POST_ID}:edit`);
  });

  it('canonicalizes an authorized slug to the immutable ID after the authority lookup', async () => {
    await expect(renderPostEditRoute('post-slug', { edit: 'true', lang: 'ja' })).rejects.toThrow(
      `redirect:/posts/${POST_ID}?edit=true&lang=ja`,
    );
    expect(mocks.getPostForEdit).toHaveBeenCalledWith('post-slug');
  });

  it('renders the existing editor for its immutable ID', async () => {
    const html = renderToStaticMarkup(await renderPostEditRoute(POST_ID, { edit: 'true' }));

    expect(html).toContain(`editor:${POST_ID}`);
    expect(mocks.getPostForEdit).toHaveBeenCalledWith(POST_ID);
  });
});
