'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { Group, Pagination } from '@mantine/core';
import { listProgramEventsForBlockBrowser } from '@/lib/queries/program-event-browser';
import { parseBooleanProp, parseIntegerProp, splitCsv } from '../list-shared';
import { ListBlockSkeleton } from '../ListBlockSkeleton';
import type { BlockViewProps } from '../types';
import { parseProgramEventListProps } from './schema';
import { ProgramEventListViewClient } from './ViewClient';

export function ProgramEventListView({ props }: BlockViewProps) {
  const locale = useLocale();
  const p = parseProgramEventListProps(props);
  const [page, setPage] = useState(1);
  const columns = parseIntegerProp(p.columns, 3);
  const limit = parseIntegerProp(p.limit, 6);
  const showPagination = parseBooleanProp(p.showPagination, false);
  const typeIds = splitCsv(p.typeIds);
  const offset = showPagination ? (page - 1) * limit : 0;

  const { data, isLoading } = useQuery({
    queryKey: [
      'program-events',
      'forBlock',
      {
        typeIds,
        seriesId: p.seriesId,
        timeWindow: p.timeWindow,
        sortBy: p.sortBy,
        sortOrder: p.sortOrder,
        limit,
        offset,
        locale,
      },
    ],
    queryFn: () =>
      listProgramEventsForBlockBrowser({
        typeIds: typeIds.length > 0 ? typeIds : undefined,
        seriesId: p.seriesId || undefined,
        timeWindow: p.timeWindow,
        sortBy: p.sortBy,
        sortOrder: p.sortOrder,
        limit,
        offset,
        requestedLocale: locale,
      }),
  });

  if (isLoading || !data) {
    return (
      <ListBlockSkeleton
        className="program-event-list-block"
        columns={columns}
        limit={limit}
        layout={p.layout}
        carouselLoop={p.carouselLoop !== 'false'}
        carouselIndicators={p.carouselIndicators !== 'false'}
      />
    );
  }

  return (
    <>
      <ProgramEventListViewClient events={data.events} parsedProps={p} locale={locale} />
      {showPagination && data.pagination.total > limit ? (
        <Group justify="center" mt="md">
          <Pagination total={Math.ceil(data.pagination.total / limit)} value={page} onChange={setPage} />
        </Group>
      ) : null}
    </>
  );
}
