import { Suspense } from 'react';
import { ServerDataTablePagination } from '@/features/data-table/ServerDataTable/ServerDataTablePagination';
import { listLabelsForBlockAction } from '@/lib/actions/label';
import { parseBooleanProp, parseIntegerProp } from '../list-shared';
import { buildBlockTableNamespace, parseBlockTableQuery, queryRecordToSearchParams } from '../table-utils';
import type { BlockViewProps } from '../types';
import { parseLabelListProps } from './schema';
import { LabelListSkeleton } from './Skeleton';
import { LabelListViewClient } from './ViewClient';

async function LabelListViewServer({ sectionId, props, query, requestedLocale }: BlockViewProps) {
  const p = parseLabelListProps(props);
  const limit = parseIntegerProp(p.limit, 12);
  const showPagination = parseBooleanProp(p.showPagination, false);
  const namespace = buildBlockTableNamespace('labelList', sectionId);
  const searchParams = queryRecordToSearchParams(query);
  const tableQuery = showPagination
    ? parseBlockTableQuery(searchParams, namespace, limit)
    : { page: 1, pageSize: limit };

  const { labels, pagination } = await listLabelsForBlockAction({
    sortBy: p.sortBy,
    sortOrder: p.sortOrder,
    limit: tableQuery.pageSize,
    offset: ((tableQuery.page ?? 1) - 1) * (tableQuery.pageSize ?? limit),
    requestedLocale,
  });

  const transformedLabels = labels.map((label) => ({
    id: label.id,
    href: `/labels/${label.slug?.trim() || label.id}`,
    title: label.name,
    imageUrl: label.imageUrl ?? null,
    imageAlt: label.name,
    countryCode: label.countryCode,
  }));

  const result = {
    data: transformedLabels,
    total: pagination.total,
    page: tableQuery.page ?? 1,
    pageSize: tableQuery.pageSize ?? limit,
    totalPages: Math.ceil(pagination.total / (tableQuery.pageSize ?? limit)),
  };

  return (
    <>
      <LabelListViewClient labels={transformedLabels} parsedProps={p} />
      {showPagination ? (
        <ServerDataTablePagination namespace={namespace} result={result} searchParams={searchParams} />
      ) : null}
    </>
  );
}

export function LabelListViewStreaming(blockProps: BlockViewProps) {
  const { props } = blockProps;
  const p = parseLabelListProps(props);
  const columns = parseIntegerProp(p.columns, 3);
  const limit = parseIntegerProp(p.limit, 12);

  return (
    <Suspense
      fallback={
        <LabelListSkeleton
          columns={columns}
          limit={limit}
          layout={p.layout}
          carouselLoop={p.carouselLoop !== 'false'}
          carouselIndicators={p.carouselIndicators !== 'false'}
        />
      }
    >
      <LabelListViewServer {...blockProps} />
    </Suspense>
  );
}
