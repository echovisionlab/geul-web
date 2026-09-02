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
