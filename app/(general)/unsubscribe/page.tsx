import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageLoader } from '@/features/site/PageLoader';
import { UnsubscribeContent } from '@/features/newsletter/UnsubscribeContent';
import { getSiteMetadataDocument } from '@/lib/queries/metadata';
import { buildPageOgMetadata } from '@/lib/utils/og';
import { withNoIndex } from '@/lib/utils/route-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('unsubscribe');
  const site = await getSiteMetadataDocument();
  const title = t('actions.unsubscribe');
  const description = t('metadata.description', { siteName: site.siteTitle || 'Site' });

  return withNoIndex(
    buildPageOgMetadata({
      canonicalOrigin: site.canonicalOrigin,
      routePath: '/unsubscribe',
      title,
      summary: description,
      siteOgImageUrl: site.siteOgImageUrl,
      siteName: site.siteTitle || undefined,
    }),
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <UnsubscribeContent />
    </Suspense>
  );
}
