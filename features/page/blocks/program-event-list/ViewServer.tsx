import { Suspense } from 'react';
import { ServerDataTablePagination } from '@/features/data-table/ServerDataTable/ServerDataTablePagination';
import { listProgramEventsForBlock } from '@/lib/queries/program-event';
import { parseBooleanProp, parseIntegerProp, splitCsv } from '../list-shared';
import { buildBlockTableNamespace, parseBlockTableQuery, queryRecordToSearchParams } from '../table-utils';
import type { BlockViewProps } from '../types';
import { parseProgramEventListProps } from './schema';
import { ProgramEventListSkeleton } from './Skeleton';
import { ProgramEventListViewClient } from './ViewClient';

async function ProgramEventListViewServer({ sectionId, props, query, requestedLocale }: BlockViewProps) {
  const p = parseProgramEventListProps(props);
  const limit = parseIntegerProp(p.limit, 6);
  const showPagination = parseBooleanProp(p.showPagination, false);
  const namespace = buildBlockTableNamespace('programEventList', sectionId);
  const searchParams = queryRecordToSearchParams(query);
  const tableQuery = showPagination
    ? parseBlockTableQuery(searchParams, namespace, limit)
    : { page: 1, pageSize: limit };
  const typeIds = splitCsv(p.typeIds);

  const { events, pagination } = await listProgramEventsForBlock({
    typeIds: typeIds.length > 0 ? typeIds : undefined,
    seriesId: p.seriesId || undefined,
    timeWindow: p.timeWindow,
    limit: tableQuery.pageSize,
    offset: ((tableQuery.page ?? 1) - 1) * (tableQuery.pageSize ?? limit),
    sortBy: p.sortBy,
    sortOrder: p.sortOrder,
    requestedLocale,
  });

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

  const result = {
    data: transformedEvents,
    total: pagination.total,
    page: tableQuery.page ?? 1,
    pageSize: tableQuery.pageSize ?? limit,
    totalPages: Math.ceil(pagination.total / (tableQuery.pageSize ?? limit)),
  };

  return (
    <>
      <ProgramEventListViewClient events={transformedEvents} parsedProps={p} locale={requestedLocale} />
      {showPagination ? (
        <ServerDataTablePagination namespace={namespace} result={result} searchParams={searchParams} />
      ) : null}
    </>
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
          carouselLoop={carouselLoop}
          carouselIndicators={carouselIndicators}
        />
      }
    >
      <ProgramEventListViewServer {...blockProps} />
    </Suspense>
  );
}
