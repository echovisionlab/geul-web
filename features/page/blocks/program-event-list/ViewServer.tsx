import { Suspense } from 'react';
import { listProgramEventsForBlock } from '@/lib/queries/program-event';
import { parseBooleanProp, parseIntegerProp, splitCsv } from '../list-shared';
import type { BlockViewProps } from '../types';
import { parseProgramEventListProps } from './schema';
import { ProgramEventListSkeleton } from './Skeleton';
import { ProgramEventListViewClient } from './ViewClient';
import { ProgramEventInfiniteList } from './InfiniteList';

async function ProgramEventListViewServer({ props, requestedLocale }: BlockViewProps) {
  const p = parseProgramEventListProps(props);
  const limit = parseIntegerProp(p.limit, 6);
  // Pagination continues the list in place: the first page renders here, later pages on demand.
  const showPagination = parseBooleanProp(p.showPagination, false);
  const typeIds = splitCsv(p.typeIds);
  const query = {
    typeIds: typeIds.length > 0 ? typeIds : undefined,
    seriesId: p.seriesId || undefined,
    timeWindow: p.timeWindow,
    sortBy: p.sortBy,
    sortOrder: p.sortOrder,
    limit,
  };

  const { events, pagination } = await listProgramEventsForBlock({ ...query, offset: 0, requestedLocale });

  const transformedEvents = events.map((event) => ({
    id: event.id,
    href: `/events/${event.slug || event.id}`,
    title: event.title,
    imageUrl: event.posterUrl,
    imageAlt: event.title,
    typeName: event.typeName,
    startsAt: event.startsAt?.toISOString() ?? null,
    endsAt: event.endsAt?.toISOString() ?? null,
    timezone: event.timezone,
    allDay: event.allDay,
    locationMode: event.locationMode,
  }));

  return showPagination ? (
    <ProgramEventInfiniteList
      initialEvents={transformedEvents}
      total={pagination.total}
      query={query}
      parsedProps={p}
      locale={requestedLocale}
    />
  ) : (
    <ProgramEventListViewClient events={transformedEvents} parsedProps={p} locale={requestedLocale} />
  );
}

export function ProgramEventListViewStreaming(blockProps: BlockViewProps) {
  const { props } = blockProps;
  const p = parseProgramEventListProps(props);
  const columns = parseIntegerProp(p.columns, 3);
  const limit = parseIntegerProp(p.limit, 6);
  const carouselLoop = p.carouselLoop !== 'false';
  const carouselIndicators = p.carouselIndicators !== 'false';

  return (
    <Suspense
      fallback={
        <ProgramEventListSkeleton
          columns={columns}
          limit={limit}
          layout={p.layout}
          itemSize={p.itemSize}
          showImage={p.showImage !== 'false'}
          imageAspectRatio={p.imageAspectRatio}
          carouselLoop={carouselLoop}
          carouselIndicators={carouselIndicators}
        />
      }
    >
      <ProgramEventListViewServer {...blockProps} />
    </Suspense>
  );
}
