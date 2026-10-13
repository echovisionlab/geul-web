'use client';
import { getCollectionMetrics } from '@/components/core/Collection/collection-contract';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useLocale, useTranslations } from 'next-intl';

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

export interface ProgramEventListViewClientProps {
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
  const metrics = getCollectionMetrics(p.itemSize);
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
      itemSize={p.itemSize}
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
                <DsLayoutStack gap="xxs">
                  {event.typeName ? (
                    <DsText size={metrics.metaSize} tone="secondary">
                      {event.typeName}
                    </DsText>
                  ) : null}
                  {date ? (
                    <DsText size={metrics.metaSize} tone="secondary">
                      {date}
                    </DsText>
                  ) : null}
                </DsLayoutStack>
              );
            }
          : undefined
      }
    />
  );
}
