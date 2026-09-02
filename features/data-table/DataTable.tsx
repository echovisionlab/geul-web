'use client';

import { useMemo, type ReactNode } from 'react';
import { Stack } from '@mantine/core';
import {
  DataTableActions,
  DataTableToolbar,
  type DataTableRowSelectionState,
  type DataTableViewRowAction,
} from '@/components/core/DataTable';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQuery } from '@/lib/types/common/query';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';
import { DataTableContent } from './DataTableContent';
import { DataTableMultiFilter } from './DataTableMultiFilter';
import { DataTableMultiSort } from './DataTableMultiSort';
import { DataTablePagination } from './DataTablePagination';
import { DataTableSearch } from './DataTableSearch';
import { DataTableContextProvider } from './DataTableContext';

export { useDataTableContext } from './DataTableContext';

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  result: PaginatedQueryResult<T> | undefined;
  loading?: boolean;
  query: PaginatedQuery;
  getRowKey: (row: T) => string;
  rowAction?: DataTableViewRowAction<T>;
  onQueryChange: (query: PaginatedQuery) => void;
  emptyMessage?: string;
  selection?: DataTableRowSelectionState<T>;
  children?: ReactNode;
}

function DataTableRoot<T>({
  columns,
  result,
  loading = false,
  query,
  getRowKey,
  rowAction,
  onQueryChange,
  emptyMessage = 'No data found.',
  selection,
  children,
}: DataTableProps<T>) {
  const contextValue = useMemo(
    () => ({
      columns,
      result,
      loading,
      query,
      getRowKey,
      rowAction,
      onQueryChange,
      emptyMessage,
      selection,
    }),
    [columns, result, loading, query, getRowKey, rowAction, onQueryChange, emptyMessage, selection],
  );

  return (
    <DataTableContextProvider value={contextValue}>
      <Stack gap="md" data-datatable-root>
        {children}
      </Stack>
    </DataTableContextProvider>
  );
}

/**
 * Default DataTable layout with all components
 */
function DataTableDefault<T>({
  searchPlaceholder = 'Search...',
  actions,
  ...props
}: DataTableProps<T> & {
  searchPlaceholder?: string;
  actions?: ReactNode;
}) {
  return (
    <DataTableRoot {...props}>
      <DataTableToolbar>
        <DataTableSearch placeholder={searchPlaceholder} />
        {actions && <DataTableActions>{actions}</DataTableActions>}
      </DataTableToolbar>
      <DataTableContent />
      <DataTablePagination />
    </DataTableRoot>
  );
}

export const DataTable = Object.assign(DataTableRoot, {
  Toolbar: DataTableToolbar,
  Search: DataTableSearch,
  MultiSort: DataTableMultiSort,
  MultiFilter: DataTableMultiFilter,
  Actions: DataTableActions,
  Content: DataTableContent,
  Pagination: DataTablePagination,
  Default: DataTableDefault,
});
