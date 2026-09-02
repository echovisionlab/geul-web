'use client';

import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import type { PublicWorkTableRow } from '@/lib/queries/work';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';
import { getWorkTableColumns } from './columns';

interface WorkTableLabels {
  title: string;
  type: string;
  period: string;
  published: string;
  present: string;
}

interface WorkTableServerContentProps {
  result: PaginatedQueryResult<PublicWorkTableRow>;
  labels: WorkTableLabels;
  emptyMessage: string;
}

export function WorkTableServerContent({ result, labels, emptyMessage }: WorkTableServerContentProps) {
  return (
    <ServerDataTable.Content
      columns={getWorkTableColumns(labels)}
      result={result}
      getRowKey={(row) => row.id}
      emptyMessage={emptyMessage}
      reservedRowCount={result.pageSize}
      showPendingLoader={false}
    />
  );
}
