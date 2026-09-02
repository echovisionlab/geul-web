'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { DataTableRowSelectionState, DataTableViewRowAction } from '@/components/core/DataTable';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQuery } from '@/lib/types/common/query';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';

export interface DataTableContextValue<T> {
  columns: ColumnDef<T>[];
  result: PaginatedQueryResult<T> | undefined;
  loading: boolean;
  query: PaginatedQuery;
  getRowKey: (row: T) => string;
  rowAction?: DataTableViewRowAction<T>;
  onQueryChange: (query: PaginatedQuery) => void;
  emptyMessage?: string;
  selection?: DataTableRowSelectionState<T>;
}

const DataTableContext = createContext<DataTableContextValue<unknown> | null>(null);

export function DataTableContextProvider<T>({
  value,
  children,
}: {
  value: DataTableContextValue<T>;
  children: ReactNode;
}) {
  return (
    <DataTableContext.Provider value={value as DataTableContextValue<unknown>}>{children}</DataTableContext.Provider>
  );
}

export function useDataTableContext<T>() {
  const context = useContext(DataTableContext);
  if (!context) {
    throw new Error('DataTable compound components must be used within DataTable');
  }
  return context as DataTableContextValue<T>;
}
