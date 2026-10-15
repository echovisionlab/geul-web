import type { LinkType, MenuItem } from '@echovisionlab/geul-proto/public/manifest_pb.ts';
import { buildPagePath } from './page-route';

/**
 * Wire values of `api.open.v1.LinkType`. The shell resolves menus on every public route; importing the
 * generated enum would also load its file descriptor and the protobuf registry runtime (about 12 kB gzip).
 * `menu.test.ts` asserts these equal the generated enum.
 */
export const MENU_LINK_TYPE = {
  UNSPECIFIED: 0 as LinkType.UNSPECIFIED,
  CUSTOM: 1 as LinkType.CUSTOM,
  PAGE: 2 as LinkType.PAGE,
  CATEGORY: 3 as LinkType.CATEGORY,
  TAG: 4 as LinkType.TAG,
  SERIES: 5 as LinkType.SERIES,
} as const;

/**
 * Resolve a menu item's URL based on its link type
 */
export function resolveMenuUrl(item: MenuItem): string {
  switch (item.linkType) {
    case MENU_LINK_TYPE.CUSTOM:
      return item.url || '#';
    case MENU_LINK_TYPE.PAGE:
      return item.targetSlug ? buildPagePath(item.targetSlug) : item.targetId ? buildPagePath(item.targetId) : '#';
    case MENU_LINK_TYPE.CATEGORY:
      return item.targetSlug ? `/category/${item.targetSlug}` : '#';
    case MENU_LINK_TYPE.TAG:
      return item.targetSlug ? `/tag/${item.targetSlug}` : '#';
    case MENU_LINK_TYPE.SERIES:
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
