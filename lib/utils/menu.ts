import { LinkType, type MenuItem } from '@echovisionlab/geul-proto/public/manifest_pb.ts';
import { buildPagePath } from './page-route';

/**
 * Resolve a menu item's URL based on its link type
 */
export function resolveMenuUrl(item: MenuItem): string {
  switch (item.linkType) {
    case LinkType.CUSTOM:
      return item.url || '#';
    case LinkType.PAGE:
      return item.targetSlug ? buildPagePath(item.targetSlug) : item.targetId ? buildPagePath(item.targetId) : '#';
    case LinkType.CATEGORY:
      return item.targetSlug ? `/category/${item.targetSlug}` : '#';
    case LinkType.TAG:
      return item.targetSlug ? `/tag/${item.targetSlug}` : '#';
    case LinkType.SERIES:
      return item.targetSlug ? `/series/${item.targetSlug}` : '#';
    default:
      return '#';
  }
}

function normalizeMenuPathname(url: string): string | null {
  const trimmedUrl = url.trim();

  if (
    !trimmedUrl ||
    trimmedUrl.startsWith('#') ||
    trimmedUrl.startsWith('?') ||
    trimmedUrl.startsWith('//') ||
    /^[a-z][a-z\d+.-]*:/i.test(trimmedUrl)
  ) {
    return null;
  }

  const pathname = trimmedUrl.split(/[?#]/, 1)[0] || '/';
  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const withoutTrailingSlash = withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, '') : withLeadingSlash;

  return withoutTrailingSlash || '/';
}

/**
 * Match a menu link against the current pathname without treating slug prefixes as descendants.
 */
export function isMenuUrlActive(pathname: string, url: string): boolean {
  const menuPathname = normalizeMenuPathname(url);

  if (!menuPathname) {
    return false;
  }

  const currentPathname = normalizeMenuPathname(pathname) ?? '/';

  if (menuPathname === '/') {
    return currentPathname === '/';
  }

  return currentPathname === menuPathname || currentPathname.startsWith(`${menuPathname}/`);
}
