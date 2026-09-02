import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { getSiteMetadataDocument } from '@/lib/queries/metadata';
import { buildStaticWebPageJsonLd } from '@/lib/utils/json-ld';
import { buildPageOgMetadata } from '@/lib/utils/og';
import { PrivacyHistoryClient } from './PrivacyHistoryClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [t, tMetadata] = await Promise.all([
    getTranslations('privacyHistory'),
    getTranslations('privacyHistory.metadata'),
  ]);
  const site = await getSiteMetadataDocument();
  const title = t('title');
  const description = tMetadata('description', { siteName: site.siteTitle || 'Site' });

  return buildPageOgMetadata({
    canonicalOrigin: site.canonicalOrigin,
    routePath: '/privacy/history',
    title,
    summary: description,
    siteOgImageUrl: site.siteOgImageUrl,
    siteName: site.siteTitle || undefined,
  });
}

export default async function PrivacyHistoryPage() {
  const [t, tMetadata] = await Promise.all([
    getTranslations('privacyHistory'),
    getTranslations('privacyHistory.metadata'),
  ]);
  const site = await getSiteMetadataDocument();
  const title = t('title');
  const description = tMetadata('description', { siteName: site.siteTitle || 'Site' });

  return (
    <>
      <JsonLdScript
        data={buildStaticWebPageJsonLd({
          site,
          routePath: '/privacy/history',
          title,
          description,
        })}
      />
      <PrivacyHistoryClient />
    </>
  );
}
