'use client';

import { useMemo } from 'react';
import { IconExternalLink } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Box, Divider, Grid, Group, Stack, Text, Title } from '@mantine/core';
import { LocationPlaceMetadataRows } from '@/features/location/LocationPlaceMetadataRows';
import {
  PublicMetadataLink,
  PublicMetadataRow,
  PublicMetadataRows,
  PublicMetadataValueGroup,
} from '@/components/core/PublicMetadata';
import { ShareButton } from '@/features/share/ShareButton';
import { TableOfContents } from '@/features/navigation/TableOfContents';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import { ContentBlockMediaRuntimeProvider } from '@/features/media/ContentBlockMediaRuntimeContext';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import { buildGeneratedBlockTocItems } from '@/lib/toc-items';
import type { ContentBlockMediaItem } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { PublicMediaEntityType } from '@echovisionlab/geul-proto/public/file_pb.ts';
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
    artist: { id: string; name: string; slug: string | null } | null;
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
  shareUrl: string;
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
  const name = credit.name || credit.artist?.name || credit.member?.name || unknownLabel;
  return formatNameWithRole(name, credit.creditRole);
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

export function ProgramEventViewClient({ event, shareUrl, locale, pathname, query, requestedLocale }: Props) {
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStates = useTranslations('common.states');
  const tProgramEventAdmin = useTranslations('programEventAdmin');
  const locationLabels: Record<ProgramEventViewData['locationMode'], string> = {
    map_place: tProgramEventAdmin('locationModes.mapPlace'),
    online: tProgramEventAdmin('locationModes.online'),
    hybrid: tProgramEventAdmin('locationModes.hybrid'),
    tba: tProgramEventAdmin('locationModes.tba'),
  };
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
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap="xs" style={{ flex: 1 }}>
          <Title order={1} style={{ fontWeight: 700, fontSize: '1.5rem' }}>
            {event.title || tCommonStates('untitledPlain')}
          </Title>
          <PublicMetadataRows>
            {event.type ? (
              <PublicMetadataRow label={tCommonLabels('type')}>
                <Text size="sm" component="span">
                  {event.type.name}
                </Text>
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
                <Text size="sm" component="span">
                  {eventDate}
                </Text>
              </PublicMetadataRow>
            ) : null}
            <PublicMetadataRow label={tCommonLabels('location')}>
              <Text size="sm" component="span">
                {locationLabels[event.locationMode]}
              </Text>
            </PublicMetadataRow>
            {event.locationPlace ? (
              <LocationPlaceMetadataRows place={event.locationPlace} textSize="sm" coordinateVisibility="desktop" />
            ) : null}
            {event.ticketUrl ? (
              <PublicMetadataRow label={tProgramEventAdmin('public.tickets')}>
                <PublicMetadataLink href={event.ticketUrl} external>
                  {formatDisplayUrl(event.ticketUrl)}
                  <IconExternalLink size={12} style={{ marginLeft: 4 }} />
                </PublicMetadataLink>
              </PublicMetadataRow>
            ) : null}
            {event.streamUrl ? (
              <PublicMetadataRow label={tProgramEventAdmin('public.stream')}>
                <PublicMetadataLink href={event.streamUrl} external>
                  {formatDisplayUrl(event.streamUrl)}
                  <IconExternalLink size={12} style={{ marginLeft: 4 }} />
                </PublicMetadataLink>
              </PublicMetadataRow>
            ) : null}
            {event.externalUrl ? (
              <PublicMetadataRow label={tProgramEventAdmin('public.link')}>
                <PublicMetadataLink href={event.externalUrl} external>
                  {formatDisplayUrl(event.externalUrl)}
                  <IconExternalLink size={12} style={{ marginLeft: 4 }} />
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
                      <Text key={client.id} size="sm" component="span">
                        {formatNameWithRole(client.name, client.role)}
                      </Text>
                    ),
                  )}
                </PublicMetadataValueGroup>
              </PublicMetadataRow>
            ) : null}
            {event.credits.length > 0 ? (
              <PublicMetadataRow label={tProgramEventAdmin('public.credits')}>
                <PublicMetadataValueGroup>
                  {event.credits.map((credit) => {
                    const label = formatCreditName(credit, tCommonStates('unknown'));
                    const href = creditHref(credit);
                    return href ? (
                      <PublicMetadataLink key={credit.id} href={href}>
                        {label}
                      </PublicMetadataLink>
                    ) : (
                      <Text key={credit.id} size="sm" component="span">
                        {label}
                      </Text>
                    );
                  })}
                </PublicMetadataValueGroup>
              </PublicMetadataRow>
            ) : null}
          </PublicMetadataRows>
        </Stack>
        <Group gap="xs">
          {languageMenu}
          <ShareButton url={shareUrl} title={event.title || tCommonStates('untitledPlain')} size="md" />
        </Group>
      </Group>
    </Stack>
  );

  return (
    <>
      <Stack gap="md">
        {event.posterUrl ? (
          <Grid gap="xl">
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Box
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
              </Box>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 5 }}>
              <MetadataSection />
            </Grid.Col>
          </Grid>
        ) : (
          <MetadataSection />
        )}

        {event.summary ? (
          <>
            <Divider />
            <Text size="md">{event.summary}</Text>
          </>
        ) : null}

        {event.content && event.content.length > 0 ? (
          <>
            <Divider />
            <Box className="prose">
              <ContentBlockMediaRuntimeProvider items={event.blockMedia}>
                {event.content.map((block) => (
                  <GeneratedRichTextBlockView
                    key={block.id}
                    block={block}
                    requestedLocale={requestedLocale}
                    downloadOwner={{ entityType: PublicMediaEntityType.PROGRAM_EVENT, entityId: event.id }}
                  />
                ))}
              </ContentBlockMediaRuntimeProvider>
            </Box>
          </>
        ) : null}
      </Stack>
      <TableOfContents items={tocItems} />
    </>
  );
}
