import type { MetadataRoute } from 'next';
import { getSiteMetadataDocument } from '@/lib/queries/metadata';

// Site metadata is runtime tenant state. Keep robots.txt out of build-time
// prerendering so a release never depends on the production API being reachable.
export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSiteMetadataDocument();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/account/', '/login', '/verify', '/my/', '/forms/', '/user/'],
      },
    ],
    sitemap: [`${site.canonicalOrigin}/sitemap.xml`],
  };
}
