/**
 * Server DataTable exports.
 *
 * A Server Component-first DataTable that uses URL search params
 * as the source of truth for pagination, sorting, and filtering.
 */

export { ServerDataTable } from './ServerDataTable';
export { ServerDataTablePaginationView } from './ServerDataTablePaginationView';
export { ServerDataTableSelectableSection } from './ServerDataTableSelectableSection';
export type { ServerDataTableProps } from './ServerDataTable';
export type { ServerDataTableContentProps } from './ServerDataTableContent';
export type { ServerDataTableSelectableSectionProps } from './ServerDataTableSelectableSection';
export type { FilterFieldConfig, ServerDataTableMultiFilterProps } from './ServerDataTableMultiFilter';
export type { ServerDataTableMultiSortProps, SortFieldConfig } from './ServerDataTableMultiSort';
export type { ServerDataTablePaginationProps } from './ServerDataTablePagination';
export type {
  ServerDataTablePaginationLabels,
  ServerDataTablePaginationViewProps,
} from './ServerDataTablePaginationView';
export type { ServerDataTableSearchProps } from './ServerDataTableSearch';
export type { ServerDataTableToolbarProps } from './ServerDataTableToolbar';

// Re-export types commonly used with DataTable
export type { ColumnDef } from '@/lib/types/common/data-table';
export type { PaginatedQueryResult } from '@/lib/types/repository/result';
