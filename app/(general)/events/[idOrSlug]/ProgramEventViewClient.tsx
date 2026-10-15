'use client';

import { Heading as DsHeading, Text as DsText } from '@/components/core/Typography';
import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutGrid as DsLayoutGrid,
  LayoutGridItem as DsLayoutGridItem,
} from '@/components/core/Layout';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { LocationPlaceMetadataRows } from '@/features/location/LocationPlaceMetadataRows';
import {
  PublicMetadataLink,
  PublicMetadataRow,
  PublicMetadataRows,
  PublicMetadataValueGroup,
} from '@/components/core/PublicMetadata';
import { CreditList } from '@/features/work/CreditList';
// Leaf modules: these documents have no authored layout, so the collaboration schema stays off the route.
import { ContentChrome } from '@/features/document-layout/ui/ContentChrome';
import { ContentLayoutView } from '@/features/document-layout/ui/ContentLayoutView';
import { FLOW_DOCUMENT_LAYOUT } from '@/features/document-layout/ui/types';
import { TableOfContents } from '@/features/navigation/TableOfContents';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import { ContentBlockMediaRuntimeProvider } from '@/features/media/ContentBlockMediaRuntimeContext';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import { buildGeneratedBlockTocItems } from '@/lib/toc-items';
import type { ContentBlockMediaItem } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { PUBLIC_MEDIA_ENTITY_TYPE } from '@/features/media-download/download-wire-values';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { formatDateTimeInZone } from '@/components/core/DateTime';
import type { LocationPlaceSummary } from '@/lib/utils/location-place';

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
  if (event.allDay) {
    return formatDateTimeInZone(event.startsAt, locale, event.timezone, 'date');
  }
  if (!event.endsAt) {
    return formatDateTimeInZone(event.startsAt, locale, event.timezone, 'dateTime');
  }
  return `${formatDateTimeInZone(event.startsAt, locale, event.timezone, 'dateTime')} - ${formatDateTimeInZone(event.endsAt, locale, event.timezone, 'dateTime')}`;
}

function formatDisplayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function formatNameWithRole(name: string, role: string | null): string {
  return role ? `${name}, ${role}` : name;
}

function formatCreditName(credit: ProgramEventViewData['credits'][number], unknownLabel: string): string {
  return credit.name || credit.artist?.name || credit.member?.name || unknownLabel;
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

  const MetadataSection = () => (
    <DsLayoutStack gap="md">
      <DsLayoutInline justify="between" align="start">
        <DsLayoutStack gap="xs" flexible>
          <DsHeading
            level={1}
            scale="title"
            lang={event.localizationInfo?.displayedLocale || event.localizationInfo?.sourceLocale || requestedLocale}
          >
            {event.title || tCommonStates('untitledPlain')}
          </DsHeading>
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
              <LocationPlaceMetadataRows place={event.locationPlace} textSize="sm" coordinateVisibility="desktop" />
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
                <PublicMetadataValueGroup>
                  {event.artists.map((artist) => (
                    <PublicMetadataLink key={artist.id} href={`/artists/${artist.slug || artist.id}`}>
                      {formatNameWithRole(artist.name, artist.role)}
                    </PublicMetadataLink>
                  ))}
                </PublicMetadataValueGroup>
              </PublicMetadataRow>
            ) : null}
            {event.labels.length > 0 ? (
              <PublicMetadataRow label={tCommonEntities('labels')}>
                <PublicMetadataValueGroup>
                  {event.labels.map((label) => (
                    <PublicMetadataLink key={label.id} href={`/labels/${label.slug || label.id}`}>
                      {formatNameWithRole(label.name, label.role)}
                    </PublicMetadataLink>
                  ))}
                </PublicMetadataValueGroup>
              </PublicMetadataRow>
            ) : null}
            {event.clients.length > 0 ? (
              <PublicMetadataRow label={tCommonEntities('clients')}>
                <PublicMetadataValueGroup>
                  {event.clients.map((client) =>
                    client.website ? (
                      <PublicMetadataLink key={client.id} href={client.website} external>
                        {formatNameWithRole(client.name, client.role)}
                      </PublicMetadataLink>
                    ) : (
                      <DsText key={client.id} size="sm" as="span">
                        {formatNameWithRole(client.name, client.role)}
                      </DsText>
                    ),
                  )}
                </PublicMetadataValueGroup>
              </PublicMetadataRow>
            ) : null}
            {event.credits.length > 0 ? (
              <PublicMetadataRow label={tProgramEventAdmin('public.credits')}>
                <DsLayoutStack gap="sm" role="list" aria-label={tProgramEventAdmin('public.credits')}>
                  {event.credits.map((credit) => (
                    <CreditList.Item
                      key={credit.id}
                      name={formatCreditName(credit, tCommonStates('unknown'))}
                      role={credit.creditRole}
                      note={credit.description}
                      href={creditHref(credit)}
                      imageUrl={credit.artist?.imageUrl ?? credit.member?.image}
                    />
                  ))}
                </DsLayoutStack>
              </PublicMetadataRow>
            ) : null}
          </PublicMetadataRows>
        </DsLayoutStack>
        <DsLayoutInline gap="xs">{languageMenu}</DsLayoutInline>
      </DsLayoutInline>
    </DsLayoutStack>
  );

  // Running text reads like a post: the plain header shares the reading column; a poster header keeps
  // its full-width grid. The outline sits beside the body (`center`).
  return (
    <ContentLayoutView
      layout={FLOW_DOCUMENT_LAYOUT}
      chrome={
        <ContentChrome measure={event.posterUrl ? 'full' : 'reading'}>
          {event.posterUrl ? (
            <DsLayoutGrid columns={12} gap="xl">
              <DsLayoutGridItem span={{ base: 12, md: 7 }}>
                <div
                  style={{
                    width: '100%',
                    maxWidth: '100%',
                  }}
                >
                  <img
                    src={event.posterUrl}
                    alt={event.title}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: 'auto',
                      maxHeight: 'min(80dvh, 900px)',
                      objectFit: 'contain',
                    }}
                  />
                </div>
              </DsLayoutGridItem>
              <DsLayoutGridItem span={{ base: 12, md: 5 }}>
                <MetadataSection />
              </DsLayoutGridItem>
            </DsLayoutGrid>
          ) : (
            <MetadataSection />
          )}
        </ContentChrome>
      }
    >
      <TableOfContents items={tocItems} contentPlacement="center">
        {event.content && event.content.length > 0 ? (
          <div
            className="prose"
            data-reading-measure=""
            lang={event.localizationInfo?.displayedLocale || event.localizationInfo?.sourceLocale || requestedLocale}
          >
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
          </div>
        ) : null}
      </TableOfContents>
    </ContentLayoutView>
  );
}
