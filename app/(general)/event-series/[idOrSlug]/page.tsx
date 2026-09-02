import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { ProgramEventSeriesPublicView } from '@/features/program-event/ProgramEventSeriesPublicView';
import { ShareButton } from '@/features/share/ShareButton';
import { getSiteMetadataDocument } from '@/lib/queries/metadata';
import {
  getProgramEventSeriesView,
  listProgramEventsForSeries,
  type PublicProgramEventListItem,
} from '@/lib/queries/program-event';
import { resolveContentRequestedLocale } from '@/lib/translation/content-language';
import { isEntityEditView } from '@/lib/utils/entity-edit-route';
import { buildProgramEventSeriesJsonLd } from '@/lib/utils/json-ld';
import { buildProgramEventSeriesOgMetadata } from '@/lib/utils/og';
import { getUserLocale } from '@/lib/utils/language.server';
import { getBaseUrl } from '@/lib/utils/url.server';
import { EventSeriesEventsTable, type EventSeriesEventsTableItem } from './EventSeriesEventsTable';
import { generatePageRouteFallbackMetadata, renderPageRouteFallback } from '@/app/_shared/page-route-fallback';
import {
  generateProgramEventSeriesEditMetadata,
  renderProgramEventSeriesEditRoute,
} from './ProgramEventSeriesEditRoute';

interface Props {
  params: Promise<{ idOrSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const EVENT_SERIES_EVENTS_PAGE_SIZE = 10;

function toEventSeriesTableItem(event: PublicProgramEventListItem): EventSeriesEventsTableItem {
  return {
    id: event.id,
    href: `/events/${event.slug || event.id}`,
    title: event.title,
    summary: event.summary,
    typeName: event.typeName,
    startsAt: event.startsAt?.toISOString() ?? null,
    endsAt: event.endsAt?.toISOString() ?? null,
    timezone: event.timezone,
    allDay: event.allDay,
    locationMode: event.locationMode,
    posterUrl: event.posterUrl,
    publishedAt: event.publishedAt?.toISOString() ?? null,
  };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ idOrSlug }, query] = await Promise.all([params, searchParams]);
  if (isEntityEditView(query)) {
    return generateProgramEventSeriesEditMetadata();
  }
  const [series, site] = await Promise.all([getProgramEventSeriesView(idOrSlug), getSiteMetadataDocument()]);

  if (!series) {
    return generatePageRouteFallbackMetadata(['event-series', idOrSlug], query);
  }

  return buildProgramEventSeriesOgMetadata({
    canonicalOrigin: site.canonicalOrigin,
    routePath: `/event-series/${series.slug || series.id}`,
    title: series.title,
    summary: series.summary,
    posterUrl: series.posterUrl,
    siteOgImageUrl: site.siteOgImageUrl,
    siteName: site.siteTitle || undefined,
  });
}

export default async function ProgramEventSeriesPage({ params, searchParams }: Props) {
  const [{ idOrSlug }, query] = await Promise.all([params, searchParams]);
  if (isEntityEditView(query)) {
    return renderProgramEventSeriesEditRoute(idOrSlug, query);
  }
  const uiLocale = await getUserLocale();
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  const series = await getProgramEventSeriesView(idOrSlug);

  if (!series) {
    return renderPageRouteFallback(['event-series', idOrSlug], query);
  }

  const [baseUrl, site, tCommonEntities, eventResult] = await Promise.all([
    getBaseUrl(),
    getSiteMetadataDocument(),
    getTranslations('common.entities'),
    listProgramEventsForSeries({
      seriesId: series.id,
      limit: EVENT_SERIES_EVENTS_PAGE_SIZE,
      requestedLocale,
    }),
  ]);

  const pathname = `/event-series/${series.slug || series.id}`;
  const shareUrl = `${baseUrl}${pathname}`;
  return (
    <>
      <JsonLdScript
        data={buildProgramEventSeriesJsonLd({
          site,
          routePath: pathname,
          title: series.title,
          summary: series.summary,
          posterUrl: series.posterUrl,
        })}
      />
      <ProgramEventSeriesPublicView
        title={series.title}
        summary={series.summary}
        description={series.description}
        posterUrl={series.posterUrl}
        controls={<ShareButton url={shareUrl} title={series.title} size="md" />}
        eventsLabel={tCommonEntities('programEvents')}
      >
        <EventSeriesEventsTable
          seriesId={series.id}
          initialEvents={eventResult.events.map(toEventSeriesTableItem)}
          initialPagination={eventResult.pagination}
          pageSize={EVENT_SERIES_EVENTS_PAGE_SIZE}
          requestedLocale={requestedLocale}
          locale={uiLocale}
        />
      </ProgramEventSeriesPublicView>
    </>
  );
}
