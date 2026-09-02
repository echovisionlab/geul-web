import { Suspense } from 'react';
import { ServerDataTablePagination } from '@/features/data-table/ServerDataTable/ServerDataTablePagination';
import { listWorksForGallery } from '@/lib/queries/work';
import { parseBooleanProp, parseIntegerProp, splitCsv } from '../list-shared';
import { buildBlockTableNamespace, parseBlockTableQuery, queryRecordToSearchParams } from '../table-utils';
import type { BlockViewProps } from '../types';
import { parseWorkListProps } from './schema';
import { WorkListSkeleton } from './Skeleton';
import { WorkListViewClient } from './ViewClient';

async function WorkListViewServer({ sectionId, props, query, requestedLocale }: BlockViewProps) {
  const p = parseWorkListProps(props);
  const limit = parseIntegerProp(p.limit, 6);
  const showPagination = parseBooleanProp(p.showPagination, false);
  const namespace = buildBlockTableNamespace('workList', sectionId);
  const searchParams = queryRecordToSearchParams(query);
  const tableQuery = showPagination
    ? parseBlockTableQuery(searchParams, namespace, limit)
    : { page: 1, pageSize: limit };
  const workTypes = splitCsv(p.workTypes) as Array<'music_project' | 'portfolio' | 'article' | 'contribution'>;

  const { works, pagination } = await listWorksForGallery({
    types: workTypes.length > 0 ? workTypes : undefined,
    featuredOnly: p.featuredOnly === 'true',
    limit: tableQuery.pageSize,
    offset: ((tableQuery.page ?? 1) - 1) * (tableQuery.pageSize ?? limit),
    sortBy: p.sortBy,
    sortOrder: p.sortOrder,
    requestedLocale,
  });

  const transformedWorks = works.map((work) => ({
    id: work.id,
    href: `/works/${work.slug || work.id}`,
    title: work.title,
    imageUrl: work.featuredImageUrl,
    imageAlt: work.title,
    type: work.type,
    publishedAt: work.publishedAt?.toISOString() ?? null,
  }));

  const result = {
    data: transformedWorks,
    total: pagination.total,
    page: tableQuery.page ?? 1,
    pageSize: tableQuery.pageSize ?? limit,
    totalPages: Math.ceil(pagination.total / (tableQuery.pageSize ?? limit)),
  };

  return (
    <>
      <WorkListViewClient works={transformedWorks} parsedProps={p} />
      {showPagination ? (
        <ServerDataTablePagination namespace={namespace} result={result} searchParams={searchParams} />
      ) : null}
    </>
  );
}

export function WorkListViewStreaming(blockProps: BlockViewProps) {
  const { props } = blockProps;
  const p = parseWorkListProps(props);
  const columns = parseIntegerProp(p.columns, 3);
  const limit = parseIntegerProp(p.limit, 6);
  const layout = p.layout || 'grid';
  const carouselLoop = p.carouselLoop !== 'false';
  const carouselIndicators = p.carouselIndicators !== 'false';

  return (
    <Suspense
      fallback={
        <WorkListSkeleton
          columns={columns}
          limit={limit}
          layout={layout}
          carouselLoop={carouselLoop}
          carouselIndicators={carouselIndicators}
        />
      }
    >
      <WorkListViewServer {...blockProps} />
    </Suspense>
  );
}
