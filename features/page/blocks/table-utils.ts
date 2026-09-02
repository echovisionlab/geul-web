import type { PaginatedQuery } from '@/lib/types/common/query';
import type { TableQuery } from '@/lib/utils/table-query';

export function buildBlockTableNamespace(prefix: string, sectionId?: string): string {
  return sectionId ? `${prefix}_${sectionId}` : prefix;
}

export function buildBlockTableAnchorId(namespace: string): string {
  return `block-table-${namespace}`;
}

export function queryRecordToSearchParams(query?: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();

  if (!query) {
    return params;
  }

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined) {
          params.append(key, item);
        }
      }
      continue;
    }

    if (value !== undefined) {
      params.set(key, value);
    }
  }

  return params;
}

export function parseBlockTableQuery(
  searchParams: URLSearchParams,
  namespace: string,
  defaultPageSize: number,
): PaginatedQuery {
  const value = searchParams.get(namespace);
  if (!value) {
    return { page: 1, pageSize: defaultPageSize };
  }

  try {
    const parsed = JSON.parse(value) as Partial<TableQuery>;
    return {
      page: typeof parsed.page === 'number' && parsed.page > 0 ? parsed.page : 1,
      pageSize: typeof parsed.pageSize === 'number' && parsed.pageSize > 0 ? parsed.pageSize : defaultPageSize,
      search: parsed.search,
      sorts: parsed.sorts as PaginatedQuery['sorts'],
      filters: parsed.filters as PaginatedQuery['filters'],
      filterBy: parsed.filterBy,
    };
  } catch {
    return { page: 1, pageSize: defaultPageSize };
  }
}
