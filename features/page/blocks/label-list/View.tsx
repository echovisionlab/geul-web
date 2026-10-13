'use client';
import { LayoutInline as DsLayoutInline, LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import { useTranslations } from 'next-intl';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Pagination } from '@/components/core/Display';
import { listLabelsForBlockAction } from '@/lib/actions/label';
import { parseBooleanProp, parseIntegerProp } from '../list-view-utils';
import { ListBlockSkeleton } from '../ListBlockSkeleton';
import type { BlockViewProps } from '../types';
import { parseLabelListProps } from './schema';
import { LabelListViewClient } from './ViewClient';

export function LabelListView({ props }: BlockViewProps) {
  const tPagination = useTranslations('dataTable.pagination');
  const p = parseLabelListProps(props);
  const [page, setPage] = useState(1);
  const sortBy = p.sortBy || 'name';
  const sortOrder = p.sortOrder || 'asc';
  const limit = parseIntegerProp(p.limit, 12);
  const columns = parseIntegerProp(p.columns, 3);
  const showPagination = parseBooleanProp(p.showPagination, false);

  const recipientsQuery = useQuery({
    queryKey: ['labels', 'forBlock', { sortBy, sortOrder, limit, page }],
    queryFn: () =>
      listLabelsForBlockAction({
        sortBy,
        sortOrder,
        limit,
        offset: showPagination ? (page - 1) * limit : 0,
      }).then(unwrapQueryResult),
  });
  const { data, isLoading } = recipientsQuery;

  if (recipientsQuery.isError && recipientsQuery.data === undefined) {
    return <QueryErrorAlert queries={[recipientsQuery]} />;
  }
  if (isLoading || !data) {
    return (
      <ListBlockSkeleton
        className="label-list-block"
        columns={columns}
        limit={Math.min(limit, 12)}
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
      <QueryErrorAlert queries={[recipientsQuery]} />
      <LabelListViewClient
        labels={data.labels.map((label) => ({
          id: label.id,
          href: `/labels/${label.slug?.trim() || label.id}`,
          title: label.name,
          imageUrl: label.imageUrl,
          imageAlt: label.name,
          countryCode: label.countryCode,
        }))}
        parsedProps={p}
      />

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
