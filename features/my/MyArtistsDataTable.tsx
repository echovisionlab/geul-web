'use client';

import { Group, Stack, Title } from '@mantine/core';
import { DataTable, type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table';
import { MyArtistsTableCellView, type MyArtistsTableRowViewModel } from '@/features/my/ui/MyArtistsTable';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQuery } from '@/lib/types/common/query';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';

export type MyArtistsDataTableQuery = PaginatedQuery;
export type MyArtistsDataTableResult = PaginatedQueryResult<MyArtistsTableRowViewModel>;

export interface MyArtistsDataTableLabels {
  title: string;
  name: string;
  status: string;
  created: string;
  empty: string;
  searchPlaceholder: string;
}

export interface MyArtistsDataTableProps {
  result: MyArtistsDataTableResult;
  labels: MyArtistsDataTableLabels;
  query: MyArtistsDataTableQuery;
  loading?: boolean;
  onQueryChange: (query: MyArtistsDataTableQuery) => void;
}

function getColumns(labels: MyArtistsDataTableLabels): ColumnDef<MyArtistsTableRowViewModel>[] {
  return [
    {
      key: 'avatar',
      header: '',
      width: 50,
      cell: (row) => <MyArtistsTableCellView cell="avatar" row={row} />,
    },
    {
      key: 'name',
      header: labels.name,
      cell: (row) => <MyArtistsTableCellView cell="name" row={row} />,
    },
    {
      key: 'status',
      header: labels.status,
      width: 120,
      cell: (row) => <MyArtistsTableCellView cell="status" row={row} />,
    },
    {
      key: 'createdAt',
      header: labels.created,
      width: 110,
      cell: (row) => <MyArtistsTableCellView cell="created" row={row} />,
    },
  ];
}

/** Connects the generic DataTable controller to the My Artists row UI. */
export function MyArtistsDataTable({ result, labels, query, loading = false, onQueryChange }: MyArtistsDataTableProps) {
  const filterFields: FilterFieldConfig[] = [{ field: 'name', label: labels.name, type: 'string' }];
  const sortFields: SortFieldConfig[] = [
    { field: 'name', label: labels.name },
    { field: 'created_at', label: labels.created },
  ];

  return (
    <Stack>
      <Title order={2}>{labels.title}</Title>

      <DataTable
        columns={getColumns(labels)}
        result={result}
        loading={loading}
        query={query}
        getRowKey={(row) => row.id}
        onQueryChange={onQueryChange}
        emptyMessage={labels.empty}
      >
        <DataTable.Toolbar>
          <DataTable.Search placeholder={labels.searchPlaceholder} />
          <Group gap={4}>
            <DataTable.MultiFilter fields={filterFields} />
            <DataTable.MultiSort fields={sortFields} />
          </Group>
        </DataTable.Toolbar>
        <DataTable.Content />
        <DataTable.Pagination />
      </DataTable>
    </Stack>
  );
}
