import type { parseTableQuery } from '@/lib/utils/table-url';
import { pageRows } from './paginated';
/** Small deterministic transport for actual table controls; fixture-supported scalar operators only. */
export function tableRows<T extends { id: string }>(
  rows: readonly T[],
  query: ReturnType<typeof parseTableQuery>,
  label: (row: T) => string,
  field: (row: T, key: string) => unknown,
) {
  const filters = query.filters ?? [];
  const matches = rows.filter((row) => {
    const evaluate = (filter: NonNullable<typeof query.filters>[number]) => {
      const actual = field(row, filter.field),
        value = filter.value;
      switch (filter.op) {
        case 'eq':
          return Array.isArray(actual)
            ? actual.some((entry) => String(entry) === String(value))
            : String(actual) === String(value);
        case 'ne':
          return Array.isArray(actual)
            ? actual.every((entry) => String(entry) !== String(value))
            : String(actual) !== String(value);
        case 'isNull':
          return value === false ? actual !== null && actual !== undefined : actual === null || actual === undefined;
        case 'gt':
        case 'gte':
        case 'lt':
        case 'lte':
        case 'between': {
          const comparable = (entry: unknown): number =>
            entry instanceof Date
              ? entry.getTime()
              : typeof entry === 'number'
                ? entry
                : typeof entry === 'string' && !Number.isNaN(Number(entry))
                  ? Number(entry)
                  : Date.parse(String(entry));
          const a = comparable(actual);
          if (filter.op === 'between') {
            return Array.isArray(value) && a >= comparable(value[0]) && a <= comparable(value[1]);
          }
          const b = comparable(value);
          return filter.op === 'gt' ? a > b : filter.op === 'gte' ? a >= b : filter.op === 'lt' ? a < b : a <= b;
        }
        case 'like':
        case 'ilike':
        case 'contains':
        case 'fulltext':
          return String(actual ?? '')
            .toLowerCase()
            .includes(
              String(value ?? '')
                .replaceAll('%', '')
                .toLowerCase(),
            );
        case 'startsWith':
          return String(actual ?? '').startsWith(String(value ?? ''));
        case 'endsWith':
          return String(actual ?? '').endsWith(String(value ?? ''));
        case 'in':
          return (
            Array.isArray(value) &&
            value.some((item) =>
              Array.isArray(actual)
                ? actual.some((entry) => String(entry) === String(item))
                : String(item) === String(actual),
            )
          );
        default:
          return true;
      }
    };
    return filters.length === 0 || (query.filterBy === 'OR' ? filters.some(evaluate) : filters.every(evaluate));
  });
  const sorted = [...matches];
  sorted.sort((left, right) => {
    for (const sort of query.sorts ?? []) {
      const a = field(left, sort.field);
      const b = field(right, sort.field);
      const order =
        a instanceof Date && b instanceof Date
          ? a.getTime() - b.getTime()
          : typeof a === 'number' && typeof b === 'number'
            ? a - b
            : String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
      if (order) {
        return sort.direction === 'desc' ? -order : order;
      }
    }
    return 0;
  });
  return pageRows(sorted, query, label);
}
