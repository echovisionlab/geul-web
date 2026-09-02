import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageLoader } from '@/features/site/PageLoader';
import { getSiteMetadataDocument } from '@/lib/queries/metadata';
import { getProgramEventView } from '@/lib/queries/program-event';
import { resolveContentRequestedLocale } from '@/lib/translation/content-language';
import { applyContentMetadataSeo, buildContentMetadataSeo } from '@/lib/translation/metadata';
import { isEntityEditView } from '@/lib/utils/entity-edit-route';
import { getUserLocale } from '@/lib/utils/language.server';
import { buildProgramEventOgMetadata } from '@/lib/utils/og';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { ProgramEventContent } from './ProgramEventContent';
import { generatePageRouteFallbackMetadata, renderPageRouteFallback } from '@/app/_shared/page-route-fallback';
import { generateProgramEventEditMetadata, renderProgramEventEditRoute } from './ProgramEventEditRoute';

interface Props {
  params: Promise<{ idOrSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ idOrSlug }, query] = await Promise.all([params, searchParams]);
  if (isEntityEditView(query)) {
    return generateProgramEventEditMetadata();
  }
  const uiLocale = await getUserLocale();
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  const [event, site] = await Promise.all([
    getProgramEventView(idOrSlug, { requestedLocale }),
    getSiteMetadataDocument(),
  ]);

  if (!event) {
    return generatePageRouteFallbackMetadata(['events', idOrSlug], query);
  }

  const routePath = `/events/${event.slug || event.id}`;
  const metadata = buildProgramEventOgMetadata({
    canonicalOrigin: site.canonicalOrigin,
    routePath,
    title: event.title,
    summary: event.summary,
    posterUrl: event.posterUrl,
    siteOgImageUrl: site.siteOgImageUrl,
    siteName: site.siteTitle || undefined,
  });
  const seo = buildContentMetadataSeo({
    canonicalOrigin: site.canonicalOrigin,
    routePath,
    query,
    localizationInfo: event.localizationInfo,
  });
  return seo.noIndex ? withNoIndex(applyContentMetadataSeo(metadata, seo)) : applyContentMetadataSeo(metadata, seo);
}

export default async function ProgramEventViewPage({ params, searchParams }: Props) {
  const [{ idOrSlug }, query] = await Promise.all([params, searchParams]);
  if (isEntityEditView(query)) {
    return renderProgramEventEditRoute(idOrSlug, query);
  }
  const uiLocale = await getUserLocale();
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  const event = await getProgramEventView(idOrSlug, { requestedLocale });

  // Resolve public visibility before entering Suspense so a missing Event
  // commits an HTTP 404 instead of streaming the loading fallback as 200.
  if (!event) {
    return renderPageRouteFallback(['events', idOrSlug], query);
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <ProgramEventContent
        idOrSlug={idOrSlug}
        initialEvent={event}
        locale={uiLocale}
        requestedLocale={requestedLocale}
        query={query}
      />
    </Suspense>
  );
}
