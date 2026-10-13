'use client';
import { LayoutInline as DsLayoutInline, LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import { useTranslations } from 'next-intl';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Pagination } from '@/components/core/Display';
import { listWorksPublishedAction } from '@/lib/actions/work';
import { parseBooleanProp, parseIntegerProp, splitCsv } from '../list-view-utils';
import { ListBlockSkeleton } from '../ListBlockSkeleton';
import type { BlockViewProps } from '../types';
import { parseWorkListProps } from './schema';
import { WorkListViewClient } from './ViewClient';

export function WorkListView({ props }: BlockViewProps) {
  const tPagination = useTranslations('dataTable.pagination');
  const p = parseWorkListProps(props);
  const [page, setPage] = useState(1);
  const columns = parseIntegerProp(p.columns, 3);
  const limit = parseIntegerProp(p.limit, 6);
  const workTypes = splitCsv(p.workTypes) as Array<'music_project' | 'portfolio' | 'article' | 'contribution'>;
  const showPagination = parseBooleanProp(p.showPagination, false);

  const recipientsQuery = useQuery({
    queryKey: ['works', 'published', { workTypes, featuredOnly: p.featuredOnly, limit, page, p }],
    queryFn: () =>
      listWorksPublishedAction({
        types: workTypes.length > 0 ? workTypes : undefined,
        featured: p.featuredOnly === 'true' ? true : undefined,
        limit,
        offset: showPagination ? (page - 1) * limit : 0,
        sortBy: p.sortBy,
        sortOrder: p.sortOrder,
      }).then(unwrapQueryResult),
  });
  const { data, isLoading } = recipientsQuery;

  if (recipientsQuery.isError && recipientsQuery.data === undefined) {
    return <QueryErrorAlert queries={[recipientsQuery]} />;
  }
  if (isLoading || !data) {
    return (
      <ListBlockSkeleton
        className="work-list-block"
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
      <QueryErrorAlert queries={[recipientsQuery]} />
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
