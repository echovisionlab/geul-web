'use client';

import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import type { PublicPostTableRow } from '@/lib/queries/post';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';
import { getPostTableColumns } from './columns';

interface PostTableLabels {
  title: string;
  authors: string;
  categories: string;
  published: string;
  untitled: string;
  unknown: string;
}

interface PostTableServerContentProps {
  result: PaginatedQueryResult<PublicPostTableRow>;
  labels: PostTableLabels;
  emptyMessage: string;
}

export function PostTableServerContent({ result, labels, emptyMessage }: PostTableServerContentProps) {
  return (
    <ServerDataTable.Content
      columns={getPostTableColumns(labels)}
      result={result}
      getRowKey={(row) => row.id}
      emptyMessage={emptyMessage}
      reservedRowCount={result.pageSize}
      showPendingLoader={false}
    />
  );
}
