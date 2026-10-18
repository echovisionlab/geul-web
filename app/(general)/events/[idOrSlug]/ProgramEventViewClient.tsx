'use client';

import { Text as DsText } from '@/components/core/Typography';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { LocationPlaceMetadataRows } from '@/features/location/LocationPlaceMetadataRows';
import { PublicMetadataLink, PublicMetadataRow, PublicMetadataRows } from '@/components/core/PublicMetadata';
import { hasPublicCredits, PublicCreditList } from '@/features/credits/PublicCreditList';
import { PublicNameList } from '@/features/credits/PublicNameList';
// Leaf modules: these documents have no authored layout, so the collaboration schema stays off the route.
import { DocumentHeadingScope } from '@/features/document-layout/ui/DocumentHeadingScope';
import { EntityDetailImage, EntityDetailLayout } from '@/features/document-layout/ui/EntityDetailLayout';
import { TableOfContents } from '@/features/navigation/TableOfContents';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import { ContentBlockMediaRuntimeProvider } from '@/features/media/ContentBlockMediaRuntimeContext';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import { buildGeneratedBlockTocItems } from '@/lib/toc-items';
import type { ContentBlockMediaItem } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { PUBLIC_MEDIA_ENTITY_TYPE } from '@/features/media-download/download-wire-values';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { formatDateTimeRange } from '@/lib/utils/date-range';
import type { LocationPlaceSummary } from '@/lib/utils/location-place';
import { formatDisplayUrl } from '@/lib/utils/url';

interface ProgramEventViewData {
  id: string;
  slug: string | null;
  title: string;
  summary: string | null;
  content: readonly LocalizedRichTextBlock[] | null;
  blockMedia: readonly ContentBlockMediaItem[];
  type: { id: string; slug: string; name: string; description: string | null } | null;
  series: { id: string; slug: string; title: string; summary: string | null } | null;
  startsAt: Date | null;
  endsAt: Date | null;
  timezone: string;
  allDay: boolean;
  locationMode: 'map_place' | 'online' | 'hybrid' | 'tba';
  locationPlace: LocationPlaceSummary | null;
  posterUrl: string | null;
  ticketUrl: string | null;
  streamUrl: string | null;
  externalUrl: string | null;
  artists: { id: string; name: string; slug: string | null; role: string | null }[];
  labels: { id: string; name: string; slug: string | null; role: string | null }[];
  clients: { id: string; name: string; website: string | null; role: string | null }[];
  credits: {
    id: string;
    name: string | null;
    creditRole: string | null;
    description: string | null;
    artist: { id: string; name: string; slug: string | null; imageUrl: string | null } | null;
    member: { id: string; name: string; image: string | null } | null;
  }[];
  publishedAt: Date | null;
  updatedAt: Date | null;
  localizationInfo?: {
    requestedLocale: string;
    displayedLocale: string;
    sourceLocale: string;
    isFallback: boolean;
    isOriginal: boolean;
    machineGenerated: boolean;
    fallbackReason: number;
    availableLocales?: string[];
  } | null;
}

interface Props {
  event: ProgramEventViewData;
  locale: string;
  pathname: string;
  query?: Record<string, string | string[] | undefined>;
  requestedLocale: string;
}

function formatEventDate(event: ProgramEventViewData, locale: string): string | null {
  if (!event.startsAt) {
    return null;
  }
  return formatDateTimeRange(event.startsAt, event.endsAt, { locale, timeZone: event.timezone, allDay: event.allDay });
}

function creditHref(credit: ProgramEventViewData['credits'][number]): string | null {
  if (credit.artist) {
    return `/artists/${credit.artist.slug || credit.artist.id}`;
  }
  if (credit.member) {
    return `/user/${credit.member.id}`;
  }
  return null;
}

export function ProgramEventViewClient({ event, locale, pathname, query, requestedLocale }: Props) {
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStates = useTranslations('common.states');
  const tProgramEventAdmin = useTranslations('programEventAdmin');
  const tocItems = useMemo(() => buildGeneratedBlockTocItems(event.content), [event.content]);
  const eventDate = formatEventDate(event, locale);
  const languageMenu = event.localizationInfo ? (
    <ContentLanguageMenu
      pathname={pathname}
      query={query}
      requestedLocale={requestedLocale}
      localizationInfo={event.localizationInfo}
    />
  ) : null;

  const creditGroups = [
    {
      id: 'credits',
      entries: event.credits.map((credit) => ({
        id: credit.id,
        name: credit.name || credit.artist?.name || credit.member?.name || null,
        role: credit.creditRole,
        note: credit.description,
        href: creditHref(credit),
      })),
    },
  ];

  const contentLang =
    event.localizationInfo?.displayedLocale || event.localizationInfo?.sourceLocale || requestedLocale;

  const body =
    event.content && event.content.length > 0 ? (
      <TableOfContents items={tocItems}>
        <div className="prose" lang={contentLang}>
          <DocumentHeadingScope parentLevel={1}>
            <ContentBlockMediaRuntimeProvider items={event.blockMedia}>
              {event.content.map((block) => (
                <GeneratedRichTextBlockView
                  key={block.id}
                  block={block}
                  requestedLocale={requestedLocale}
                  downloadOwner={{ entityType: PUBLIC_MEDIA_ENTITY_TYPE.PROGRAM_EVENT, entityId: event.id }}
                />
              ))}
            </ContentBlockMediaRuntimeProvider>
          </DocumentHeadingScope>
        </div>
      </TableOfContents>
    ) : null;

  return (
    <EntityDetailLayout
      body={body}
      media={event.posterUrl ? <EntityDetailImage src={event.posterUrl} alt={event.title} /> : undefined}
      title={event.title || tCommonStates('untitledPlain')}
      titleLang={contentLang}
      actions={languageMenu}
      meta={
        <PublicMetadataRows>
          {event.type ? (
            <PublicMetadataRow label={tCommonLabels('type')}>
              <DsText size="sm" as="span">
                {event.type.name}
              </DsText>
            </PublicMetadataRow>
          ) : null}
          {event.series ? (
            <PublicMetadataRow label={tProgramEventAdmin('public.series')}>
              <PublicMetadataLink href={`/event-series/${event.series.slug || event.series.id}`}>
                {event.series.title}
              </PublicMetadataLink>
            </PublicMetadataRow>
          ) : null}
          {eventDate ? (
            <PublicMetadataRow label={tProgramEventAdmin('public.date')}>
              <DsText size="sm" as="span">
                {eventDate}
              </DsText>
            </PublicMetadataRow>
          ) : null}
          {event.locationPlace ? (
            <LocationPlaceMetadataRows place={event.locationPlace} textSize="sm" coordinateVisibility="never" />
          ) : null}
          {event.ticketUrl ? (
            <PublicMetadataRow label={tProgramEventAdmin('public.tickets')}>
              <PublicMetadataLink href={event.ticketUrl} external indicator="external">
                {formatDisplayUrl(event.ticketUrl)}
              </PublicMetadataLink>
            </PublicMetadataRow>
          ) : null}
          {event.streamUrl ? (
            <PublicMetadataRow label={tProgramEventAdmin('public.stream')}>
              <PublicMetadataLink href={event.streamUrl} external indicator="external">
                {formatDisplayUrl(event.streamUrl)}
              </PublicMetadataLink>
            </PublicMetadataRow>
          ) : null}
          {event.externalUrl ? (
            <PublicMetadataRow label={tProgramEventAdmin('public.link')}>
              <PublicMetadataLink href={event.externalUrl} external indicator="external">
                {formatDisplayUrl(event.externalUrl)}
              </PublicMetadataLink>
            </PublicMetadataRow>
          ) : null}
          {event.artists.length > 0 ? (
            <PublicMetadataRow label={tCommonEntities('artists')}>
              <PublicNameList
                items={event.artists.map((artist) => ({ ...artist, href: `/artists/${artist.slug || artist.id}` }))}
              />
            </PublicMetadataRow>
          ) : null}
          {event.labels.length > 0 ? (
            <PublicMetadataRow label={tCommonEntities('labels')}>
              <PublicNameList
                items={event.labels.map((label) => ({ ...label, href: `/labels/${label.slug || label.id}` }))}
              />
            </PublicMetadataRow>
          ) : null}
          {event.clients.length > 0 ? (
            <PublicMetadataRow label={tCommonEntities('clients')}>
              <PublicNameList
                items={event.clients.map((client) => ({ ...client, href: client.website, external: true }))}
              />
            </PublicMetadataRow>
          ) : null}
          {hasPublicCredits(creditGroups) ? (
            <PublicMetadataRow label={tProgramEventAdmin('public.credits')}>
              <PublicCreditList groups={creditGroups} label={tProgramEventAdmin('public.credits')} />
            </PublicMetadataRow>
          ) : null}
        </PublicMetadataRows>
      }
    />
  );
}
