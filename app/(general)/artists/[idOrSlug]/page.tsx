import type { Metadata } from 'next';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { ShareLinkEntityType } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import { getTranslations } from 'next-intl/server';
import { createPublicShareLinkClient } from '@/lib/api/server-client';
import { getArtistView } from '@/lib/queries/artist';
import { getArtistMetadataDocument } from '@/lib/queries/metadata';
import { resolveContentRequestedLocale } from '@/lib/translation/content-language';
import {
  applyContentMetadataSeo,
  buildContentMetadataSeo,
  resolveLocalizedOgFallbacks,
} from '@/lib/translation/metadata';
import { getRequestHeaders } from '@/lib/utils/header.server';
import { getUserLocale } from '@/lib/utils/language.server';
import { buildArtistOgMetadata } from '@/lib/utils/og';
import { isEntityEditView } from '@/lib/utils/entity-edit-route';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { getBaseUrl } from '@/lib/utils/url.server';
import { generatePageRouteFallbackMetadata, renderPageRouteFallback } from '@/app/_shared/page-route-fallback';
import { ArtistPublicContent } from './ArtistPublicContent';
import { ArtistShareViewClient } from './ArtistShareViewClient';
import { generateArtistEditMetadata, renderArtistEditRoute } from './ArtistEditRoute';

interface Props {
  params: Promise<{ idOrSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ idOrSlug }, query] = await Promise.all([params, searchParams]);
  if (isEntityEditView(query)) {
    return generateArtistEditMetadata(idOrSlug);
  }
  const shareToken = Array.isArray(query.share) ? query.share[0] : query.share;
  if (shareToken) {
    await connection();
    return withNoIndex({ referrer: 'no-referrer' });
  }
  const tCommonEntities = await getTranslations('common.entities');
  const uiLocale = await getUserLocale();
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  const artist = await getArtistMetadataDocument(idOrSlug, { requestedLocale });
  if (!artist) {
    return generatePageRouteFallbackMetadata(['artists', idOrSlug], query);
  }
  const ogFallbacks = resolveLocalizedOgFallbacks(artist.localizationInfo, {
    featuredImageUrl: artist.imageUrl,
    siteOgImageUrl: artist.site.siteOgImageUrl,
  });
  const metadata = buildArtistOgMetadata({
    canonicalOrigin: artist.site.canonicalOrigin,
    routePath: artist.routePath,
    name: artist.name || tCommonEntities('artist'),
    bio: artist.bio ?? undefined,
    ogImageUrl: artist.ogImageUrl,
    imageUrl: ogFallbacks.featuredImageUrl,
    siteOgImageUrl: ogFallbacks.siteOgImageUrl,
    siteName: artist.site.siteTitle || undefined,
  });
  const seo = buildContentMetadataSeo({
    canonicalOrigin: artist.site.canonicalOrigin,
    routePath: artist.routePath,
    query,
    localizationInfo: artist.localizationInfo,
  });
  const localizedMetadata = applyContentMetadataSeo(metadata, seo);
  return seo.noIndex ? withNoIndex(localizedMetadata) : localizedMetadata;
}

export default async function ArtistViewPage({ params, searchParams }: Props) {
  await connection();
  const [{ idOrSlug }, query] = await Promise.all([params, searchParams]);
  if (isEntityEditView(query)) {
    return renderArtistEditRoute(idOrSlug, query);
  }
  await getRequestHeaders();

  const shareToken = Array.isArray(query.share) ? query.share[0] : query.share;
  const uiLocale = await getUserLocale();
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  if (shareToken) {
    const validation = await createPublicShareLinkClient()
      .validate({ token: shareToken })
      .catch(() => null);
    if (
      !validation ||
      validation.entityType !== ShareLinkEntityType.ARTIST ||
      (!validation.valid && !validation.passwordRequired)
    ) {
      notFound();
    }
    if (validation.passwordRequired) {
      return (
        <ArtistShareViewClient
          token={shareToken}
          idOrSlug={idOrSlug}
          requestedLocale={requestedLocale}
          uiLocale={uiLocale}
        />
      );
    }
  }

  const [artist, artistMetadata, baseUrl] = await Promise.all([
    getArtistView(idOrSlug, { requestedLocale, shareToken }),
    shareToken ? Promise.resolve(null) : getArtistMetadataDocument(idOrSlug, { requestedLocale }),
    getBaseUrl(),
  ]);
  if (!artist) {
    return renderPageRouteFallback(['artists', idOrSlug], query);
  }
  return (
    <ArtistPublicContent
      artist={artist}
      artistMetadata={artistMetadata}
      baseUrl={baseUrl}
      query={query}
      requestedLocale={requestedLocale}
      uiLocale={uiLocale}
    />
  );
}
