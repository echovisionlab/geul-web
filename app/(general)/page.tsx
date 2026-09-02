// Server Component - no 'use client'
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Center, Stack, Text, Title } from '@mantine/core';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { PageContentView } from '@/features/page/PageView/PageContentView';
import { PageMediaDeliveryProvider } from '@/features/page/PageMediaDeliveryContext';
import { getPublicPage } from '@/lib/queries/manifest';
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
  const [page, home] = await Promise.all([
    getPublicPage('/', { requestedLocale }),
    getHomeMetadataDocument({ requestedLocale }),
  ]);
  const homeJsonLd = buildHomeJsonLd(home);

  if (!page) {
    return (
      <>
        <JsonLdScript data={homeJsonLd} />
        <Center mih="60vh">
          <Stack align="center" gap="xs">
            <Title order={1}>{t('title')}</Title>
            <Text c="dimmed">{t('description')}</Text>
          </Stack>
        </Center>
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
