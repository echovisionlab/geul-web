import { describe, expect, it } from 'vitest';
import { resolvePreviewStory, type PreviewRoute } from './preview-navigation';

const routes: PreviewRoute[] = [
  {
    route: '/posts/[idOrSlug]',
    previews: [
      { storyTitle: 'Pages/Editors/Post', storyId: 'pages-editors-post--ready', branch: 'edit' },
      { storyTitle: 'Pages/Public/Documents', storyId: 'pages-public-documents--post' },
    ],
  },
  {
    route: '/posts',
    previews: [{ storyTitle: 'Pages/Public/Documents', storyId: 'pages-public-documents--posts-index' }],
  },
  {
    route: '/[...slug]',
    previews: [{ storyTitle: 'Pages/Public/Documents', storyId: 'pages-public-documents--page' }],
  },
];

describe('local preview navigation', () => {
  it('prefers exact and parameterized routes over the catch-all page', () => {
    expect(resolvePreviewStory('/posts', routes)).toBe('pages-public-documents--posts-index');
    expect(resolvePreviewStory('/posts/session', routes)).toBe('pages-public-documents--post');
  });
  it('selects the editor branch only when requested', () => {
    expect(resolvePreviewStory('/posts/session?edit=true', routes)).toBe('pages-editors-post--ready');
    expect(resolvePreviewStory('/posts/session?edit=false', routes)).toBe('pages-public-documents--post');
  });
  it('keeps direct Storybook links and excludes external destinations', () => {
    expect(resolvePreviewStory('/?path=/story/pages-public-documents--post', routes)).toBe(
      'pages-public-documents--post',
    );
    expect(resolvePreviewStory('https://example.com/posts', routes)).toBeNull();
    expect(resolvePreviewStory('//example.com/posts', routes)).toBeNull();
  });
  it('does not reinterpret a Documentation link as an application home route', () => {
    const homeRoutes: PreviewRoute[] = [
      { route: '/', previews: [{ storyTitle: 'Pages/Public/Documents', storyId: 'pages-public-documents--home' }] },
    ];
    expect(resolvePreviewStory('/?path=/docs/pages-auth-login--documentation', homeRoutes)).toBeNull();
    expect(resolvePreviewStory('/', homeRoutes)).toBe('pages-public-documents--home');
  });
  it('does not invent previews for unmapped routes or editor branches', () => {
    expect(resolvePreviewStory('/unknown', [])).toBeNull();
    expect(resolvePreviewStory('/unknown', routes)).toBeNull();
    expect(resolvePreviewStory('/posts?edit=true', routes)).toBeNull();
  });
});
