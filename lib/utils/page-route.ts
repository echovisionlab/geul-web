export type PageSlugValidationReason = 'invalidPath' | 'emptySegment' | 'dotSegment' | 'reservedRoute';

const FIXED_PAGE_ROUTE_NAMESPACES = new Set([
  '_next',
  'account',
  'admin',
  'api',
  'auth',
  'category',
  'changelog',
  'favicon.ico',
  'files',
  'login',
  'manifest.webmanifest',
  'my',
  'onboarding',
  'privacy',
  'robots.txt',
  's',
  'sitemap',
  'sitemap.xml',
  'sitemaps',
  'subscribe',
  'tag',
  'terms',
  'tools',
  'unsubscribe',
  'user',
  'verification',
  'verify',
]);

// These exact roots are CMS Pages while their child paths remain app-owned.
const CMS_PAGE_ROOT_EXCEPTIONS = new Set(['tools']);

export function getPageSlugValidationReason(slug: string): PageSlugValidationReason | undefined {
  if (slug === '') {
    return undefined;
  }
  if (slug !== slug.trim()) {
    return 'invalidPath';
  }
  if (slug.startsWith('/') || slug.endsWith('/') || slug.includes('//')) {
    return 'emptySegment';
  }

  const segments = slug.split('/');
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return 'dotSegment';
  }

  const root = segments[0]?.toLowerCase() ?? '';
  const isCmsPageRoot = segments.length === 1 && CMS_PAGE_ROOT_EXCEPTIONS.has(root);
  if (FIXED_PAGE_ROUTE_NAMESPACES.has(root) && !isCmsPageRoot) {
    return 'reservedRoute';
  }
  return undefined;
}

export function buildPagePath(idOrSlug: string): string {
  return `/${idOrSlug.split('/').map(encodeURIComponent).join('/')}`;
}

export function buildPageEditPath(idOrSlug: string, currentSearch?: string | URLSearchParams): string {
  const search = new URLSearchParams(currentSearch);
  search.set('edit', 'true');
  return `${buildPagePath(idOrSlug)}?${search.toString()}`;
}
