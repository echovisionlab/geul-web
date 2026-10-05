import type { Metadata } from 'next';
import { getPublicLegalHistory } from '@/lib/queries/legal-history.server';
import { getUserLocale } from '@/lib/utils/language.server';
import { resolveContentRequestedLocale } from '@/lib/translation/content-language';
import { getTranslations } from 'next-intl/server';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { getSiteMetadataDocument } from '@/lib/queries/metadata';
import { buildStaticWebPageJsonLd } from '@/lib/utils/json-ld';
import { buildPageOgMetadata } from '@/lib/utils/og';
import { TermsHistoryClient } from './TermsHistoryClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [t, tMetadata] = await Promise.all([getTranslations('termsHistory'), getTranslations('termsHistory.metadata')]);
  const site = await getSiteMetadataDocument();
  const title = t('title');
  const description = tMetadata('description', { siteName: site.siteTitle || 'Site' });

  return buildPageOgMetadata({
    canonicalOrigin: site.canonicalOrigin,
    routePath: '/terms/history',
    title,
    summary: description,
    siteOgImageUrl: site.siteOgImageUrl,
    siteName: site.siteTitle || undefined,
  });
}

export default async function TermsHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const requestedLocale = resolveContentRequestedLocale(await getUserLocale(), await searchParams);
  const history = getPublicLegalHistory('terms', requestedLocale).catch(() => undefined);
  const [t, tMetadata] = await Promise.all([getTranslations('termsHistory'), getTranslations('termsHistory.metadata')]);
  const site = await getSiteMetadataDocument();
  const title = t('title');
  const description = tMetadata('description', { siteName: site.siteTitle || 'Site' });

  return (
    <>
      <JsonLdScript
        data={buildStaticWebPageJsonLd({
          site,
          routePath: '/terms/history',
          title,
          description,
        })}
      />
      <TermsHistoryClient initialData={await history} />
    </>
  );
}
