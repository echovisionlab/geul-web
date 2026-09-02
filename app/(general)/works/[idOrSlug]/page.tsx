// Server Component - no 'use client'
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { ShareLinkEntityType } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { PageLoader } from '@/features/site/PageLoader';
import { createPublicShareLinkClient } from '@/lib/api/server-client';
import { getWorkMetadataDocument } from '@/lib/queries/metadata';
import { resolveContentRequestedLocale } from '@/lib/translation/content-language';
import {
  applyContentMetadataSeo,
  buildContentMetadataSeo,
  resolveLocalizedOgFallbacks,
} from '@/lib/translation/metadata';
import { buildWorkJsonLd } from '@/lib/utils/json-ld';
import { getUserLocale } from '@/lib/utils/language.server';
import { buildWorkOgMetadata } from '@/lib/utils/og';
import { isEntityEditView } from '@/lib/utils/entity-edit-route';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { joinUrl } from '@/lib/utils/url';
import { generatePageRouteFallbackMetadata, renderPageRouteFallback } from '@/app/_shared/page-route-fallback';
import { WorkContent } from './WorkContent';
import { WorkContentWithToken } from './WorkContentWithToken';
import { WorkShareViewClient } from './WorkShareViewClient';
import { generateWorkEditMetadata, renderWorkEditRoute } from './WorkEditRoute';

interface Props {
  params: Promise<{ idOrSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ idOrSlug }, query] = await Promise.all([params, searchParams]);
  if (isEntityEditView(query)) {
    return generateWorkEditMetadata(idOrSlug);
  }

  if (query.share) {
    await connection();
  }
  const uiLocale = await getUserLocale();
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  const work = await getWorkMetadataDocument(idOrSlug, { requestedLocale });

  if (!work) {
    return generatePageRouteFallbackMetadata(['works', idOrSlug], query);
  }

  const ogFallbacks = resolveLocalizedOgFallbacks(work.localizationInfo, {
    featuredImageUrl: work.featuredImageUrl,
    siteOgImageUrl: work.site.siteOgImageUrl,
  });
  const metadata = buildWorkOgMetadata({
    canonicalOrigin: work.site.canonicalOrigin,
    routePath: work.routePath,
    title: work.title,
    summary: work.summary,
    ogImageUrl: work.ogImageUrl,
    ...ogFallbacks,
    publishedAt: work.publishedAt,
    siteName: work.site.siteTitle || undefined,
  });
  const seo = buildContentMetadataSeo({
    canonicalOrigin: work.site.canonicalOrigin,
    routePath: work.routePath,
    query,
    localizationInfo: work.localizationInfo,
  });
  const localizedMetadata = applyContentMetadataSeo(metadata, seo);

  if (!query.share) {
    return seo.noIndex ? withNoIndex(localizedMetadata) : localizedMetadata;
  }

  return withNoIndex({
    ...localizedMetadata,
    alternates: {
      canonical: joinUrl(work.site.canonicalOrigin, work.routePath),
    },
  });
}

export default async function WorkViewPage({ params, searchParams }: Props) {
  const [{ idOrSlug }, query] = await Promise.all([params, searchParams]);

  if (isEntityEditView(query)) {
    return renderWorkEditRoute(idOrSlug, query);
  }

  const shareToken = Array.isArray(query.share) ? query.share[0] : query.share;
  if (shareToken) {
    await connection();
  }
  const uiLocale = await getUserLocale();
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);

  // Share link mode: bypass access checks with token verification
  if (shareToken) {
    const validation = await createPublicShareLinkClient()
      .validate({ token: shareToken })
      .catch(() => null);
    if (
      !validation ||
      validation.entityType !== ShareLinkEntityType.WORK ||
      (!validation.valid && !validation.passwordRequired)
    ) {
      return renderPageRouteFallback(['works', idOrSlug], query);
    }
    if (validation.passwordRequired) {
      return (
        <WorkShareViewClient
          token={shareToken}
          idOrSlug={idOrSlug}
          locale={uiLocale}
          requestedLocale={requestedLocale}
        />
      );
    }
    return (
      <Suspense fallback={<PageLoader />}>
        <WorkContentWithToken idOrSlug={idOrSlug} token={shareToken} requestedLocale={requestedLocale} query={query} />
      </Suspense>
    );
  }

  // Normal mode: use Suspense for streaming when render is pending
  const workMetadata = await getWorkMetadataDocument(idOrSlug, {
    requestedLocale,
  });

  if (!workMetadata) {
    return renderPageRouteFallback(['works', idOrSlug], query);
  }

  return (
    <>
      {workMetadata && <JsonLdScript data={buildWorkJsonLd(workMetadata)} />}
      <Suspense fallback={<PageLoader />}>
        <WorkContent idOrSlug={idOrSlug} requestedLocale={requestedLocale} query={query} />
      </Suspense>
    </>
  );
}
