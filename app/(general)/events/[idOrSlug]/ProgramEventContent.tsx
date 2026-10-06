import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { getSiteMetadataDocument } from '@/lib/queries/metadata';
import { getProgramEventView } from '@/lib/queries/program-event';
import { buildProgramEventJsonLd } from '@/lib/utils/json-ld';
import { ProgramEventViewClient } from './ProgramEventViewClient';

interface Props {
  idOrSlug: string;
  initialEvent: NonNullable<Awaited<ReturnType<typeof getProgramEventView>>>;
  locale: string;
  requestedLocale: string;
  query?: Record<string, string | string[] | undefined>;
}

function transformProgramEventForView(event: NonNullable<Awaited<ReturnType<typeof getProgramEventView>>>) {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    summary: event.summary,
    content: event.content,
    blockMedia: event.blockMedia,
    type: event.type,
    series: event.series,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
    allDay: event.allDay,
    locationMode: event.locationMode,
    locationPlace: event.locationPlace,
    posterUrl: event.posterUrl,
    ticketUrl: event.ticketUrl,
    streamUrl: event.streamUrl,
    externalUrl: event.externalUrl,
    artists: event.artists,
    labels: event.labels,
    clients: event.clients,
    credits: event.credits,
    publishedAt: event.publishedAt,
    updatedAt: event.updatedAt,
    localizationInfo: event.localizationInfo ?? null,
  };
}

export async function ProgramEventContent({ initialEvent, locale, requestedLocale, query }: Props) {
  const event = initialEvent;

  const site = await getSiteMetadataDocument();
  const pathname = `/events/${event.slug || event.id}`;
  const transformedEvent = transformProgramEventForView(event);
  const jsonLd = buildProgramEventJsonLd({
    site,
    routePath: pathname,
    title: transformedEvent.title,
    summary: transformedEvent.summary,
    posterUrl: transformedEvent.posterUrl,
    startsAt: transformedEvent.startsAt,
    endsAt: transformedEvent.endsAt,
    locationMode: transformedEvent.locationMode,
    locationPlace: transformedEvent.locationPlace,
    ticketUrl: transformedEvent.ticketUrl,
    streamUrl: transformedEvent.streamUrl,
    externalUrl: transformedEvent.externalUrl,
    participants: [
      ...transformedEvent.artists.map((artist) => artist.name),
      ...transformedEvent.credits.map((credit) => credit.name).filter((name): name is string => Boolean(name)),
    ],
    updatedAt: transformedEvent.updatedAt,
  });

  return (
    <>
      <JsonLdScript data={jsonLd} />
      <ProgramEventViewClient
        event={transformedEvent}
        locale={locale}
        pathname={pathname}
        query={query}
        requestedLocale={requestedLocale}
      />
    </>
  );
}
