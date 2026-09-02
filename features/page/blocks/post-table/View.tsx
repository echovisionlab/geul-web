'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { DataTable } from '@/features/data-table/DataTable';
import { listPublishedPostsTable } from '@/lib/queries/post-browser';
import type { PaginatedQuery } from '@/lib/types/common/query';
import type { BlockViewProps } from '../types';
import { getPostTableColumns } from './columns';
import { parsePostTableProps } from './schema';

export function PostTableView({ props }: BlockViewProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const parsed = parsePostTableProps(props);
  const [query, setQuery] = useState<PaginatedQuery>({
    page: 1,
    pageSize: parseInt(parsed.pageSize || '10', 10),
  });

  const categoryIds = parsed.categoryIds ? parsed.categoryIds.split(',').filter(Boolean) : undefined;
  const tagIds = parsed.tagIds ? parsed.tagIds.split(',').filter(Boolean) : undefined;
  const authorIds = parsed.authorIds ? parsed.authorIds.split(',').filter(Boolean) : undefined;
  const seriesId = parsed.seriesId || undefined;
  const statuses = parsed.statuses
    ? parsed.statuses.split(',').filter(Boolean)
    : ['POST_STATUS_PUBLISHED', 'POST_STATUS_ARCHIVED'];

  const { data, isLoading } = useQuery({
    queryKey: ['page-block', 'post-table', parsed, query],
    queryFn: () =>
      listPublishedPostsTable({
        query,
        pageSize: parseInt(parsed.pageSize || '10', 10),
        categoryIds,
        tagIds,
        authorIds,
        seriesId,
        statuses,
      }),
  });

  return (
    <DataTable
      columns={getPostTableColumns({
        title: tCommon('labels.title'),
        authors: tCommon('labels.authors'),
        categories: tCommonEntities('categories'),
        published: tCommon('labels.published'),
        untitled: tCommon('states.untitled'),
        unknown: tCommon('states.unknown'),
      })}
      result={data}
      loading={isLoading}
      query={query}
      onQueryChange={setQuery}
      getRowKey={(row) => row.id}
      emptyMessage={tCommon('messages.noPostsFound')}
    >
      <DataTable.Content reservedRowCount={parseInt(parsed.pageSize || '10', 10)} />
      <DataTable.Pagination />
    </DataTable>
  );
}
