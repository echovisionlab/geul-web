'use client';
import { LayoutInline as DsLayoutInline, LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import { useTranslations, useLocale } from 'next-intl';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pagination } from '@/components/core/Display';
import { listProgramEventsForBlockBrowser } from '@/lib/queries/program-event-browser';
import { parseBooleanProp, parseIntegerProp, splitCsv } from '../list-view-utils';
import { ListBlockSkeleton } from '../ListBlockSkeleton';
import type { BlockViewProps } from '../types';
import { parseProgramEventListProps } from './schema';
import { ProgramEventListViewClient } from './ViewClient';
export function ProgramEventListView({ props }: BlockViewProps) {
  const tPagination = useTranslations('dataTable.pagination');
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
        itemSize={p.itemSize}
        showImage={p.showImage !== 'false'}
        imageAspectRatio={p.imageAspectRatio}
        carouselLoop={p.carouselLoop !== 'false'}
        carouselIndicators={p.carouselIndicators !== 'false'}
      />
    );
  }
  return (
    <>
      <ProgramEventListViewClient events={data.events} parsedProps={p} locale={locale} />
      {showPagination && data.pagination.total > limit ? (
        <DsLayoutInset blockStart="md">
          <DsLayoutInline justify="center">
            <Pagination
              total={Math.ceil(data.pagination.total / limit)}
              value={page}
              onChange={setPage}
              labels={{
                previousPage: tPagination('previousPage'),
                nextPage: tPagination('nextPage'),
                page: (page) => tPagination('page', { page }),
              }}
            />
          </DsLayoutInline>
        </DsLayoutInset>
      ) : null}
    </>
  );
}
