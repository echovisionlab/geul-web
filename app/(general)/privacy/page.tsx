import type { Metadata } from 'next';
import { connection } from 'next/server';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { getPublicLegalPagePresentation } from '@/features/policy/public-legal-page.server';
import { resolveContentRequestedLocale } from '@/lib/translation/content-language';
import {
  applyContentMetadataSeo,
  buildContentMetadataSeo,
  resolveLocalizedOgFallbacks,
} from '@/lib/translation/metadata';
import { buildStaticWebPageJsonLd } from '@/lib/utils/json-ld';
import { getUserLocale } from '@/lib/utils/language.server';
import { buildPageOgMetadata } from '@/lib/utils/og';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { PrivacyPageClient } from './PrivacyPageClient';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = await searchParams;
  if (query.token) {
    await connection();
    return withNoIndex({ referrer: 'no-referrer' });
  }
  const requestedLocale = resolveContentRequestedLocale(await getUserLocale(), query);
  const { site, snapshot, title, description } = await getPublicLegalPagePresentation('privacy', requestedLocale);
  const policy = snapshot?.policy;
  const seo = buildContentMetadataSeo({
    canonicalOrigin: site.canonicalOrigin,
    routePath: '/privacy',
    query,
    localizationInfo: policy?.localizationInfo ?? null,
  });

  const ogFallbacks = resolveLocalizedOgFallbacks(policy?.localizationInfo, {
    siteOgImageUrl: site.siteOgImageUrl,
  });
  const metadata = buildPageOgMetadata({
    canonicalOrigin: site.canonicalOrigin,
    routePath: '/privacy',
    title,
    summary: description,
    ogImageUrl: policy?.ogAsset?.url ?? null,
    ...ogFallbacks,
    siteName: site.siteTitle || undefined,
  });

  const localizedMetadata = applyContentMetadataSeo(metadata, seo);

  return seo.noIndex ? withNoIndex(localizedMetadata) : localizedMetadata;
}

export default async function PrivacyPage({ searchParams }: Props) {
  const query = await searchParams;
  if (query.token) {
    await connection();
    return <PrivacyPageClient />;
  }
  const requestedLocale = resolveContentRequestedLocale(await getUserLocale(), query);
  const { site, snapshot, title, description } = await getPublicLegalPagePresentation('privacy', requestedLocale);

  return (
    <>
      <JsonLdScript
        data={buildStaticWebPageJsonLd({
          site,
          routePath: '/privacy',
          title,
          description,
        })}
      />
      <PrivacyPageClient
        initialData={snapshot ? { requestedLocale, data: snapshot.data, updatedAt: snapshot.updatedAt } : undefined}
      />
    </>
  );
}
