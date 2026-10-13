import { filterSpecSchema } from '@/lib/utils/table-query';
import { tableRows } from './table-query';

/** Adapts the production client tables' singular filter/sort transport to the local query engine. */
export function transportRows<T extends { id: string }>(
  rows: readonly T[],
  query: {
    search?: string;
    page?: number;
    pageSize?: number;
    filter?: unknown;
    filterBy?: 'AND' | 'OR';
    sort?: Array<{ field: string; order?: 'asc' | 'desc' }>;
  },
  label: (row: T) => string,
) {
  return tableRows(
    rows,
    {
      ...query,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      filters: Array.isArray(query.filter)
        ? query.filter.flatMap((value) => {
            const parsed = filterSpecSchema.safeParse(value);
            return parsed.success ? [parsed.data] : [];
          })
        : undefined,
      sorts: query.sort?.map((sort) => ({ field: sort.field, direction: sort.order ?? 'asc' })),
    },
    label,
    (row, key) => {
      const value = Object.entries(row).find(
        ([name]) => name === key || name.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`) === key,
      )?.[1];
      return Array.isArray(value)
        ? value.map((item) => (typeof item === 'object' && item !== null && 'id' in item ? item.id : item))
        : value;
    },
  );
}
