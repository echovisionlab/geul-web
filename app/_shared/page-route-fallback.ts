import PageRoute, { generateMetadata as generatePageRouteMetadata } from '@/app/(general)/[...slug]/page';

export type PageRouteSearchParams = Record<string, string | string[] | undefined>;

export function renderPageRouteFallback(slugSegments: string[], query: PageRouteSearchParams) {
  return PageRoute({
    params: Promise.resolve({ slug: slugSegments }),
    searchParams: Promise.resolve(query),
  });
}

export function generatePageRouteFallbackMetadata(slugSegments: string[], query: PageRouteSearchParams) {
  return generatePageRouteMetadata({
    params: Promise.resolve({ slug: slugSegments }),
    searchParams: Promise.resolve(query),
  });
}
