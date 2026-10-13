import type { Metadata } from 'next';
import { SitemapPageView } from '@/features/navigation/SitemapPageView';
import { getTranslations } from 'next-intl/server';

import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { getSiteMetadataDocument } from '@/lib/queries/metadata';
import { buildStaticWebPageJsonLd } from '@/lib/utils/json-ld';
import { buildPageOgMetadata } from '@/lib/utils/og';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('sitemapPage');
  const site = await getSiteMetadataDocument();
  const title = t('metadata.title');
  const description = t('metadata.description', { siteName: site.siteTitle || 'Site' });

  return buildPageOgMetadata({
    canonicalOrigin: site.canonicalOrigin,
    routePath: '/sitemap',
    title,
    summary: description,
    siteOgImageUrl: site.siteOgImageUrl,
    siteName: site.siteTitle || undefined,
  });
}

export default async function SitemapPage() {
  const t = await getTranslations('sitemapPage');
  const site = await getSiteMetadataDocument();
  const title = t('metadata.title');
  const description = t('metadata.description', { siteName: site.siteTitle || 'Site' });
  return (
    <>
      <JsonLdScript
        data={buildStaticWebPageJsonLd({
          site,
          routePath: '/sitemap',
          title,
          description,
        })}
      />
      <SitemapPageView />
    </>
  );
}
