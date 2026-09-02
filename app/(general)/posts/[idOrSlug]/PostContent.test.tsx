import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPostAllowedActions: vi.fn(),
  toPostViewModel: vi.fn((post) => post),
}));

vi.mock('@/features/draft-mode/DraftModeAlert', () => ({
  DraftModeAlert: ({ status }: { status: string }) => <div>alert:{status}</div>,
}));

vi.mock('@/lib/queries/post', () => ({
  getPostView: vi.fn(),
  getPostViewWithToken: vi.fn(),
  getPostAllowedActions: mocks.getPostAllowedActions,
}));

vi.mock('@/features/post/PostViewContent', () => ({
  PostViewContent: ({
    post,
    allowedActions,
  }: {
    post: { title: string; canEdit?: boolean };
    allowedActions: number[];
  }) => (
    <div>
      title:{post.title};actions:{allowedActions.join(',')};can-edit:{String(post.canEdit)}
    </div>
  ),
}));

vi.mock('@/features/post/post-view-model', () => ({
  toPostViewModel: mocks.toPostViewModel,
}));

import { PostContent } from './PostContent';
import { PostContentWithToken } from './PostContentWithToken';

type PublicPost = Parameters<typeof PostContent>[0]['initialPost'];
type SharedPost = Parameters<typeof PostContentWithToken>[0]['initialPost'];

describe('typed post content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPostAllowedActions.mockResolvedValue([1, 2]);
  });

  it('renders the route-authorized typed document without a render projection poll', async () => {
    const post = {
      id: 'post-1',
      slug: 'post-slug',
      status: 'published',
      title: 'Authoritative title',
    } as PublicPost;

    const html = renderToStaticMarkup(
      await PostContent({
        idOrSlug: 'post-slug',
        initialPost: post,
        requestedLocale: 'ko',
      }),
    );

    expect(mocks.getPostAllowedActions).toHaveBeenCalledWith('post-1');
    expect(html).toContain('title:Authoritative title');
    expect(html).toContain('actions:1,2');
    expect(html).toContain('can-edit:true');
  });

  it('renders the token-authorized typed document directly', async () => {
    const post = {
      id: 'post-1',
      slug: 'post-slug',
      status: 'draft',
      title: 'Authoritative draft',
    } as SharedPost;

    const html = renderToStaticMarkup(
      await PostContentWithToken({
        idOrSlug: 'post-slug',
        token: 'valid-token',
        initialPost: post,
        requestedLocale: 'ko',
      }),
    );

    expect(html).toContain('alert:draft');
    expect(html).toContain('title:Authoritative draft');
    expect(html).toContain('can-edit:true');
  });

  it('does not expose editor entry when the API grants no edit action', async () => {
    mocks.getPostAllowedActions.mockResolvedValue([]);
    const post = {
      id: 'post-1',
      slug: 'post-slug',
      status: 'published',
      title: 'Published title',
    } as PublicPost;

    const html = renderToStaticMarkup(
      await PostContent({
        idOrSlug: 'post-slug',
        initialPost: post,
        requestedLocale: 'ko',
      }),
    );

    expect(html).toContain('can-edit:false');
  });
});
