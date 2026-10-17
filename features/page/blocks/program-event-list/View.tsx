'use client';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { listProgramEventsForBlockBrowser } from '@/lib/queries/program-event-browser';
import { parseBooleanProp, parseIntegerProp, splitCsv } from '../list-view-utils';
import { ListBlockSkeleton } from '../ListBlockSkeleton';
import type { BlockViewProps } from '../types';
import { parseProgramEventListProps } from './schema';
import { ProgramEventListViewClient } from './ViewClient';
import { ProgramEventInfiniteList } from './InfiniteList';
export function ProgramEventListView({ props }: BlockViewProps) {
  const locale = useLocale();
  const p = parseProgramEventListProps(props);
  const columns = parseIntegerProp(p.columns, 3);
  const limit = parseIntegerProp(p.limit, 6);
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
  const { data, isLoading } = useQuery({
    queryKey: ['program-events', 'forBlock', { ...query, offset: 0, locale }],
    queryFn: () => listProgramEventsForBlockBrowser({ ...query, offset: 0, requestedLocale: locale }),
  });
  if (isLoading || !data) {
    return (
      <ListBlockSkeleton
        className="program-event-list-block"
        columns={columns}
        limit={limit}
        layout={p.layout}
        itemSize={p.itemSize}
        showImage={p.showImage !== 'false'}
        imageAspectRatio={p.imageAspectRatio}
        carouselLoop={p.carouselLoop !== 'false'}
        carouselIndicators={p.carouselIndicators !== 'false'}
      />
    );
  }
  return showPagination ? (
    <ProgramEventInfiniteList
      key={JSON.stringify(query)}
      initialEvents={data.events}
      total={data.pagination.total}
      query={query}
      parsedProps={p}
      locale={locale}
    />
  ) : (
    <ProgramEventListViewClient events={data.events} parsedProps={p} locale={locale} />
  );
}
