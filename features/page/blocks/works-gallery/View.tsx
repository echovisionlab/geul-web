'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Group, Pagination } from '@mantine/core';
import { listWorksPublishedAction } from '@/lib/actions/work';
import { parseBooleanProp, parseIntegerProp, splitCsv } from '../list-shared';
import { ListBlockSkeleton } from '../ListBlockSkeleton';
import type { BlockViewProps } from '../types';
import { parseWorkListProps } from './schema';
import { WorkListViewClient } from './ViewClient';

export function WorkListView({ props }: BlockViewProps) {
  const p = parseWorkListProps(props);
  const [page, setPage] = useState(1);
  const columns = parseIntegerProp(p.columns, 3);
  const limit = parseIntegerProp(p.limit, 6);
  const workTypes = splitCsv(p.workTypes) as Array<'music_project' | 'portfolio' | 'article' | 'contribution'>;
  const showPagination = parseBooleanProp(p.showPagination, false);

  const { data, isLoading } = useQuery({
    queryKey: ['works', 'published', { workTypes, featuredOnly: p.featuredOnly, limit, page, p }],
    queryFn: () =>
      listWorksPublishedAction({
        types: workTypes.length > 0 ? workTypes : undefined,
        featured: p.featuredOnly === 'true' ? true : undefined,
        limit,
        offset: showPagination ? (page - 1) * limit : 0,
        sortBy: p.sortBy,
        sortOrder: p.sortOrder,
      }),
  });

  if (isLoading || !data) {
    return (
      <ListBlockSkeleton
        className="work-list-block"
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
      <WorkListViewClient
        works={data.works.map((work) => ({
          id: work.id,
          href: `/works/${work.slug || work.id}`,
          title: work.title,
          imageUrl: work.featuredImageUrl,
          imageAlt: work.title,
          type: work.type,
          publishedAt: work.publishedAt?.toISOString() ?? null,
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
