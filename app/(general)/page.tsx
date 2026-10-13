// Server Component - no 'use client'

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Heading as DsHeading, Text as DsText } from '@/components/core/Typography';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { PageContentView } from '@/features/page/PageView/PageContentView';
import { PageMediaDeliveryProvider } from '@/features/page/PageMediaDeliveryContext';
import { getPageAccessView } from '@/lib/queries/page';
import { PageRestrictedAccess } from '@/features/page/PageRestrictedAccess';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { getHomeMetadataDocument } from '@/lib/queries/metadata';
import { resolveContentRequestedLocale } from '@/lib/translation/content-language';
import { resolveLocalizedMetadataSummary, resolveLocalizedOgFallbacks } from '@/lib/translation/metadata';
import { buildHomeJsonLd } from '@/lib/utils/json-ld';
import { getUserLocale } from '@/lib/utils/language.server';
import { buildPageOgMetadata } from '@/lib/utils/og';

import './[...slug]/page-view.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const [query, uiLocale] = await Promise.all([searchParams, getUserLocale()]);
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  const access = await getPageAccessView('/', { requestedLocale });
  if (access && access.reason !== 'allowed') {
    const tAccess = await getTranslations('pageEditor.access');
    return withNoIndex({
      title: tAccess(access.reason === 'authentication-required' ? 'loginRequiredTitle' : 'restrictedTitle'),
    });
  }
  const home = await getHomeMetadataDocument({ requestedLocale });
  const ogFallbacks = resolveLocalizedOgFallbacks(home.localizationInfo, {
    featuredImageUrl: home.featuredImageUrl,
    siteOgImageUrl: home.site.siteOgImageUrl,
  });
  const summary = resolveLocalizedMetadataSummary(home.localizationInfo, home.summary, home.site.siteDescription);

  const ogMetadata = buildPageOgMetadata({
    canonicalOrigin: home.site.canonicalOrigin,
    routePath: home.routePath,
    title: home.title,
    summary,
    ogImageUrl: home.ogImageUrl,
    ...ogFallbacks,
    siteName: home.site.siteTitle || undefined,
  });

  return {
    ...ogMetadata,
    title: { absolute: home.title },
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations('home.emptyState');
  const [query, uiLocale] = await Promise.all([searchParams, getUserLocale()]);
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  const access = await getPageAccessView('/', { requestedLocale });
  if (access && access.reason !== 'allowed') {
    return <PageRestrictedAccess reason={access.reason} returnTo="/" />;
  }
  const page = access?.page ?? null;
  const home = await getHomeMetadataDocument({ requestedLocale });
  const homeJsonLd = buildHomeJsonLd(home);

  if (!page) {
    return (
      <>
        <JsonLdScript data={homeJsonLd} />
        <div style={{ minHeight: '60vh' }}>
          <DsLayoutStack align="center" justify="center">
            <DsLayoutStack align="center" gap="xs">
              <DsHeading level={1}>{t('title')}</DsHeading>
              <DsText tone="secondary">{t('description')}</DsText>
            </DsLayoutStack>
          </DsLayoutStack>
        </div>
      </>
    );
  }

  return (
    <>
      <JsonLdScript data={homeJsonLd} />
      <PageMediaDeliveryProvider idOrSlug="/" requestedLocale={requestedLocale}>
        <PageContentView page={page} pathname="/" query={query} requestedLocale={requestedLocale} />
      </PageMediaDeliveryProvider>
    </>
  );
}
