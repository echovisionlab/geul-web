'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Group, Pagination } from '@mantine/core';
import { listLabelsForBlockAction } from '@/lib/actions/label';
import { parseBooleanProp, parseIntegerProp } from '../list-shared';
import { ListBlockSkeleton } from '../ListBlockSkeleton';
import type { BlockViewProps } from '../types';
import { parseLabelListProps } from './schema';
import { LabelListViewClient } from './ViewClient';

export function LabelListView({ props }: BlockViewProps) {
  const p = parseLabelListProps(props);
  const [page, setPage] = useState(1);
  const sortBy = p.sortBy || 'name';
  const sortOrder = p.sortOrder || 'asc';
  const limit = parseIntegerProp(p.limit, 12);
  const columns = parseIntegerProp(p.columns, 3);
  const showPagination = parseBooleanProp(p.showPagination, false);

  const { data, isLoading } = useQuery({
    queryKey: ['labels', 'forBlock', { sortBy, sortOrder, limit, page }],
    queryFn: () =>
      listLabelsForBlockAction({
        sortBy,
        sortOrder,
        limit,
        offset: showPagination ? (page - 1) * limit : 0,
      }),
  });

  if (isLoading || !data) {
    return (
      <ListBlockSkeleton
        className="label-list-block"
        columns={columns}
        limit={Math.min(limit, 12)}
        layout={p.layout}
        carouselLoop={p.carouselLoop !== 'false'}
        carouselIndicators={p.carouselIndicators !== 'false'}
      />
    );
  }

  return (
    <>
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
        <Group justify="center" mt="md">
          <Pagination total={Math.ceil(data.pagination.total / limit)} value={page} onChange={setPage} />
        </Group>
      ) : null}
    </>
  );
}
