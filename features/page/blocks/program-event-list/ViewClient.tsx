'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Stack, Text } from '@mantine/core';
import { formatDateTimeInZone } from '@/components/core/DateTime';
import { useRequestTimeZone } from '@/lib/providers/RequestTimeZoneProvider';
import { EntityListView, type EntityListItem } from '../EntityListView';
import type { ProgramEventListProps } from './schema';

interface ProgramEventListItem extends EntityListItem {
  typeName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  allDay: boolean;
  locationMode: 'map_place' | 'online' | 'hybrid' | 'tba';
}

interface ProgramEventListViewClientProps {
  events: ProgramEventListItem[];
  parsedProps: ProgramEventListProps;
  locale?: string;
}

function formatEventDate(event: ProgramEventListItem, locale: string, requestTimeZone: string): string | null {
  if (!event.startsAt) {
    return null;
  }
  const timeZone = event.timezone || requestTimeZone;
  if (event.allDay) {
    return formatDateTimeInZone(event.startsAt, locale, timeZone, 'date', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  }
  return formatDateTimeInZone(event.startsAt, locale, timeZone, 'dateTime', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function ProgramEventListViewClient({
  events,
  parsedProps: p,
  locale: localeProp,
}: ProgramEventListViewClientProps) {
  const contextLocale = useLocale();
  const locale = localeProp || contextLocale;
  const requestTimeZone = useRequestTimeZone();
  const tProgramEventAdmin = useTranslations('programEventAdmin');
  const locationLabels: Record<ProgramEventListItem['locationMode'], string> = {
    map_place: tProgramEventAdmin('locationModes.mapPlace'),
    online: tProgramEventAdmin('locationModes.online'),
    hybrid: tProgramEventAdmin('locationModes.hybrid'),
    tba: tProgramEventAdmin('locationModes.tba'),
  };
  const layout = p.layout || 'grid';
  const columns = parseInt(p.columns || '3', 10);
  const showImage = p.showImage !== 'false';
  const showMeta = p.showMeta !== 'false';
  const imageAspectRatio = p.imageAspectRatio || '16:9';
  const carouselLoop = p.carouselLoop !== 'false';
  const carouselIndicators = p.carouselIndicators !== 'false';

  return (
    <EntityListView
      items={events}
      className="program-event-list-block"
      emptyLabel={tProgramEventAdmin('public.empty')}
      layout={layout}
      columns={columns}
      showImage={showImage}
      imageAspectRatio={imageAspectRatio}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
      renderMeta={
        showMeta
          ? (event) => {
              const date = formatEventDate(event, locale, requestTimeZone);
              return (
                <Stack gap={2}>
                  {event.typeName ? (
                    <Text size="xs" c="dimmed">
                      {event.typeName}
                    </Text>
                  ) : null}
                  {date ? (
                    <Text size="xs" c="dimmed">
                      {date}
                    </Text>
                  ) : null}
                  <Text size="xs" c="dimmed">
                    {locationLabels[event.locationMode]}
                  </Text>
                </Stack>
              );
            }
          : undefined
      }
    />
  );
}
