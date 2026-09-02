import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { materializeLocalizedRichTextTree } from '@/features/editor/contract/localized-rich-text';
import { localizedRichTextPlainText } from '@/features/editor/contract/localized-rich-text-text';
import { createPublicPrivacyClientWithAuth } from '@/lib/api/server-client';
import { getSiteMetadataDocument } from '@/lib/queries/metadata';
import { resolveContentRequestedLocale } from '@/lib/translation/content-language';
import {
  applyContentMetadataSeo,
  buildContentMetadataSeo,
  resolveLocalizedOgFallbacks,
} from '@/lib/translation/metadata';
import { buildStaticWebPageJsonLd } from '@/lib/utils/json-ld';
import { getUserLocale } from '@/lib/utils/language.server';
import { buildPageOgMetadata, truncateForDescription } from '@/lib/utils/og';
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
  const [t, tCommonEntities, site, uiLocale] = await Promise.all([
    getTranslations('privacyPage.metadata'),
    getTranslations('common.entities'),
    getSiteMetadataDocument(),
    getUserLocale(),
  ]);
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  const response = await createPublicPrivacyClientWithAuth(requestedLocale)
    .then((client) => client.get({}))
    .catch(() => null);
  const title = response?.privacy?.title?.trim() || tCommonEntities('privacy');
  const description =
    truncateForDescription(
      response?.privacy?.document
        ? localizedRichTextPlainText(materializeLocalizedRichTextTree(response.privacy.document))
        : null,
    ) || t('description', { siteName: site.siteTitle || 'Site' });
  const seo = buildContentMetadataSeo({
    canonicalOrigin: site.canonicalOrigin,
    routePath: '/privacy',
    query,
    localizationInfo: response?.privacy?.localizationInfo ?? null,
  });

  const ogFallbacks = resolveLocalizedOgFallbacks(response?.privacy?.localizationInfo, {
    siteOgImageUrl: site.siteOgImageUrl,
  });
  const metadata = buildPageOgMetadata({
    canonicalOrigin: site.canonicalOrigin,
    routePath: '/privacy',
    title,
    summary: description,
    ogImageUrl: response?.privacy?.ogAsset?.url ?? null,
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
  const [t, tCommonEntities, site, uiLocale] = await Promise.all([
    getTranslations('privacyPage.metadata'),
    getTranslations('common.entities'),
    getSiteMetadataDocument(),
    getUserLocale(),
  ]);
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  const response = await createPublicPrivacyClientWithAuth(requestedLocale)
    .then((client) => client.get({}))
    .catch(() => null);
  const title = response?.privacy?.title?.trim() || tCommonEntities('privacy');
  const description =
    truncateForDescription(
      response?.privacy?.document
        ? localizedRichTextPlainText(materializeLocalizedRichTextTree(response.privacy.document))
        : null,
    ) || t('description', { siteName: site.siteTitle || 'Site' });

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
      <PrivacyPageClient />
    </>
  );
}
