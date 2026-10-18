import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/utils/table-query-defaults';
import type { FilterLogic, FilterOperator, FilterSpec } from './filter';

// ===== Sort Types =====

export type SortDirection = 'asc' | 'desc';

export interface SortSpec<T extends string = string> {
  field: T;
  direction: SortDirection;
}

// ===== Query Types =====

/**
 * Query parameters for paginated data requests
 */
export interface PaginatedQuery<
  TSortField extends string = string,
  TFilterField extends string = string,
  TOp extends FilterOperator = FilterOperator,
> {
  page?: number;
  pageSize?: number;
  search?: string;
  sorts?: SortSpec<TSortField>[];
  filters?: FilterSpec<TFilterField, TOp>[];
  filterBy?: FilterLogic;
}

/**
 * Maps a table query to the list action input shared by paginated list actions: `sorts` become
 * `sort` with `direction` as `order`, filters pass through unchanged, and a missing page or page
 * size falls back to the table defaults. A missing `filterBy` stays unset for the action to default.
 */
export function toPaginatedListInput<TSortField extends string, TFilter>(query: {
  page?: number;
  pageSize?: number;
  search?: string;
  sorts?: { field: TSortField; direction: SortDirection }[];
  filters?: TFilter[];
  filterBy?: FilterLogic;
}) {
  return {
    filter: query.filters,
    filterBy: query.filterBy,
    sort: query.sorts?.map((sort) => ({ field: sort.field, order: sort.direction })),
    page: query.page ?? DEFAULT_PAGE,
    pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE,
    search: query.search,
  };
}
