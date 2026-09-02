import { LinkType, type MenuItem } from '@echovisionlab/geul-proto/public/manifest_pb.ts';
import { describe, expect, it } from 'vitest';
import { isMenuUrlActive, resolveMenuUrl } from './menu';

describe('isMenuUrlActive', () => {
  it('matches exact links and slash-delimited descendant paths', () => {
    expect(isMenuUrlActive('/test', '/test')).toBe(true);
    expect(isMenuUrlActive('/test/child', '/test')).toBe(true);
  });

  it('does not match sibling slugs that only share a prefix', () => {
    expect(isMenuUrlActive('/test-label', '/test')).toBe(false);
    expect(isMenuUrlActive('/test', '/test-label')).toBe(false);
  });

  it('only activates the home link on the home page', () => {
    expect(isMenuUrlActive('/', '/')).toBe(true);
    expect(isMenuUrlActive('/test', '/')).toBe(false);
  });

  it('ignores external and hash-only links', () => {
    expect(isMenuUrlActive('/test', 'https://example.com/test')).toBe(false);
    expect(isMenuUrlActive('/test', '//example.com/test')).toBe(false);
    expect(isMenuUrlActive('/test', '#content')).toBe(false);
    expect(isMenuUrlActive('/', '?preview=true')).toBe(false);
  });
});

describe('resolveMenuUrl', () => {
  it('keeps Page menu links valid with either the current slug or the stable Page UUID', () => {
    expect(resolveMenuUrl(menuItem(LinkType.PAGE, 'about', 'page-uuid'))).toBe('/about');
    expect(resolveMenuUrl(menuItem(LinkType.PAGE, 'some/한글 page', 'page-uuid'))).toBe(
      '/some/%ED%95%9C%EA%B8%80%20page',
    );
    expect(resolveMenuUrl(menuItem(LinkType.PAGE, '', 'page-uuid'))).toBe('/page-uuid');
  });

  it('routes taxonomy and event series menu targets through public slugs', () => {
    expect(resolveMenuUrl(menuItem(LinkType.CATEGORY, 'news'))).toBe('/category/news');
    expect(resolveMenuUrl(menuItem(LinkType.TAG, 'ambient'))).toBe('/tag/ambient');
    expect(resolveMenuUrl(menuItem(LinkType.SERIES, 'weekly-picks'))).toBe('/series/weekly-picks');
  });
});

function menuItem(linkType: LinkType, targetSlug: string, targetId?: string): MenuItem {
  return {
    $typeName: 'api.open.v1.MenuItem',
    id: targetSlug,
    label: targetSlug,
    linkType,
    targetId,
    targetSlug,
    children: [],
    openInNewTab: false,
  };
}
