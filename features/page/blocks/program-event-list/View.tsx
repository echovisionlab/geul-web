'use client';
import { useLocale } from 'next-intl';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
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
  const queryResult = useQuery({
    queryKey: ['program-events', 'forBlock', { ...query, offset: 0, locale }],
    queryFn: () => listProgramEventsForBlockBrowser({ ...query, offset: 0, requestedLocale: locale }),
  });
  const { data, isLoading } = queryResult;
  if (queryResult.isError && data === undefined) {
    return <QueryErrorAlert queries={[queryResult]} />;
  }
  if (isLoading) {
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
  if (!data) {
    return null;
  }
  return (
    <>
      <QueryErrorAlert queries={[queryResult]} />
      {showPagination ? (
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
      )}
    </>
  );
}
