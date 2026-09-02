'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { DataTable } from '@/features/data-table/DataTable';
import { listPublishedWorksTable } from '@/lib/queries/work-browser';
import type { PaginatedQuery } from '@/lib/types/common/query';
import type { WorkType } from '@/lib/types/work/model';
import type { BlockViewProps } from '../types';
import { getWorkTableColumns } from './columns';
import { parseWorkTableProps } from './schema';

export function WorkTableView({ props }: BlockViewProps) {
  const t = useTranslations('publicTables');
  const tCommon = useTranslations('common');
  const parsed = parseWorkTableProps(props);
  const [query, setQuery] = useState<PaginatedQuery>({
    page: 1,
    pageSize: parseInt(parsed.pageSize || '10', 10),
  });
  const workTypes = parsed.workTypes ? (parsed.workTypes.split(',').filter(Boolean) as WorkType[]) : undefined;
  const featuredOnly = parsed.featuredOnly === 'true';
  const statuses = parsed.statuses ? parsed.statuses.split(',').filter(Boolean) : ['WORK_STATUS_PUBLISHED'];

  const { data, isLoading } = useQuery({
    queryKey: ['page-block', 'work-table', parsed, query],
    queryFn: () =>
      listPublishedWorksTable({
        query,
        pageSize: parseInt(parsed.pageSize || '10', 10),
        types: workTypes,
        featuredOnly,
        statuses,
      }),
  });

  return (
    <DataTable
      columns={getWorkTableColumns({
        title: tCommon('labels.title'),
        type: tCommon('labels.type'),
        period: t('workColumns.period'),
        published: tCommon('labels.published'),
        present: t('workColumns.present'),
      })}
      result={data}
      loading={isLoading}
      query={query}
      onQueryChange={setQuery}
      getRowKey={(row) => row.id}
      emptyMessage={tCommon('messages.noWorksFound')}
    >
      <DataTable.Content reservedRowCount={parseInt(parsed.pageSize || '10', 10)} />
      <DataTable.Pagination />
    </DataTable>
  );
}
