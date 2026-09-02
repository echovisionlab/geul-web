/**
 * URL builder utilities for Server Component DataTable.
 *
 * These utilities help construct URLs with table query state,
 * enabling navigation via Link components without client-side state.
 *
 * @example
 * // Build pagination URL
 * const nextPageUrl = buildTableUrl('artists', searchParams, { page: 2 });
 * // Result: ?artists={"page":2}
 *
 * // Build sort URL
 * const sortUrl = buildTableUrl('artists', searchParams, {
 *   sorts: [{ field: 'name', direction: 'asc' }],
 *   page: 1
 * });
 */

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  type TableFilterSpec,
  type TableQuery,
  type TableSortSpec,
} from './table-query';

// Type for URLSearchParams-like objects (includes ReadonlyURLSearchParams from next/navigation)
type SearchParamsLike = {
  get: (name: string) => string | null;
  toString: () => string;
};

// ============================================================================
// URL Building
// ============================================================================

/**
 * Build a URL with updated table query parameters.
 *
 * @param namespace - Table namespace (e.g., 'artists')
 * @param currentParams - Current URLSearchParams or ReadonlyURLSearchParams
 * @param updates - Partial query updates to apply
 * @param pathname - Optional pathname (defaults to current path)
 * @returns URL string with updated query parameters
 */
function buildTableUrl(
  namespace: string,
  currentParams: SearchParamsLike,
  updates: Partial<TableQuery>,
  pathname = '',
): string {
  // Parse current state for this namespace
  const currentValue = currentParams.get(namespace);
  const current: TableQuery = currentValue ? JSON.parse(currentValue) : {};

  // Merge updates
  const merged: TableQuery = { ...current, ...updates };

  // Clean up default values to keep URL minimal
  const cleaned = cleanQuery(merged);

  // Build new params
  const newParams = new URLSearchParams(currentParams.toString());

  if (Object.keys(cleaned).length > 0) {
    newParams.set(namespace, JSON.stringify(cleaned));
  } else {
    newParams.delete(namespace);
  }

  const queryString = newParams.toString();
  return queryString ? `${pathname}?${queryString}` : pathname || '?';
}

/**
 * Build a pagination URL.
 */
export function buildPaginationUrl(
  namespace: string,
  currentParams: SearchParamsLike,
  page: number,
  pathname = '',
): string {
  return buildTableUrl(namespace, currentParams, { page }, pathname);
}

/**
 * Build a search URL. Resets to page 1.
 */
export function buildSearchUrl(
  namespace: string,
  currentParams: SearchParamsLike,
  search: string | undefined,
  pathname = '',
): string {
  return buildTableUrl(namespace, currentParams, { search, page: 1 }, pathname);
}

/**
 * Build a sort URL. Resets to page 1.
 */
export function buildSortUrl(
  namespace: string,
  currentParams: SearchParamsLike,
  sorts: TableSortSpec[] | undefined,
  pathname = '',
): string {
  return buildTableUrl(namespace, currentParams, { sorts, page: 1 }, pathname);
}

/**
 * Build a filter URL. Resets to page 1.
 */
export function buildFilterUrl(
  namespace: string,
  currentParams: SearchParamsLike,
  filters: TableFilterSpec[] | undefined,
  filterBy?: 'AND' | 'OR',
  pathname = '',
): string {
  return buildTableUrl(namespace, currentParams, { filters, filterBy, page: 1 }, pathname);
}

// ============================================================================
// Parsing
// ============================================================================

/**
 * Parse a namespace's query from URLSearchParams.
 */
export function parseTableQuery(searchParams: SearchParamsLike, namespace: string): TableQuery {
  const value = searchParams.get(namespace);
  if (!value) {
    return { page: DEFAULT_PAGE, pageSize: DEFAULT_PAGE_SIZE };
  }

  try {
    const parsed = JSON.parse(value);
    return {
      page: parsed.page ?? DEFAULT_PAGE,
      pageSize: parsed.pageSize ?? DEFAULT_PAGE_SIZE,
      search: parsed.search,
      sorts: parsed.sorts,
      filters: parsed.filters,
      filterBy: parsed.filterBy,
    };
  } catch {
    return { page: DEFAULT_PAGE, pageSize: DEFAULT_PAGE_SIZE };
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Remove default values from query to keep URL minimal.
 */
function cleanQuery(query: TableQuery): Partial<TableQuery> {
  const cleaned: Partial<TableQuery> = {};

  if (query.page !== undefined && query.page !== DEFAULT_PAGE) {
    cleaned.page = query.page;
  }

  if (query.pageSize !== undefined && query.pageSize !== DEFAULT_PAGE_SIZE) {
    cleaned.pageSize = query.pageSize;
  }

  if (query.search) {
    cleaned.search = query.search;
  }

  if (query.sorts && query.sorts.length > 0) {
    cleaned.sorts = query.sorts;
  }

  if (query.filters && query.filters.length > 0) {
    cleaned.filters = query.filters;
  }

  if (query.filterBy) {
    cleaned.filterBy = query.filterBy;
  }

  return cleaned;
}
