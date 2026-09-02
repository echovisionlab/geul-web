/**
 * PaginatedQueryResult<T> - Standard paginated response structure for multiple entities
 */
export interface PaginatedQueryResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Creates a PaginatedQueryResult from raw data
 */
export function createPaginatedQueryResult<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedQueryResult<T> {
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
