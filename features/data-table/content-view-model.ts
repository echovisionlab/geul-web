import type { DataTableViewColumn } from '@/components/core/DataTable';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { SortSpec } from '@/lib/types/common/query';

export interface DataTableSortFieldConfig {
  field: string;
  label: string;
}

export const DEFAULT_DATA_TABLE_MAX_SORTS = 3;

function getCellValue<T>(row: T, column: ColumnDef<T>): unknown {
  if (column.accessor) {
    if (typeof column.accessor === 'function') {
      return column.accessor(row);
    }
    return row[column.accessor];
  }
  return (row as Record<string, unknown>)[column.key];
}

function renderCellContent<T>(row: T, column: ColumnDef<T>) {
  return column.cell ? column.cell(row) : String(getCellValue(row, column) ?? '-');
}

function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

function toCamelCase(value: string): string {
  return value.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

export function parseDataTableSortConfig(raw: string | null): DataTableSortFieldConfig[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is DataTableSortFieldConfig =>
        typeof item === 'object' && item !== null && typeof item.field === 'string' && typeof item.label === 'string',
    );
  } catch {
    return [];
  }
}

export function parseDataTableMaxSorts(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DATA_TABLE_MAX_SORTS;
  }
  return parsed;
}

export function areDataTableSortConfigsEqual(left: DataTableSortFieldConfig[], right: DataTableSortFieldConfig[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item.field === right[index]?.field && item.label === right[index]?.label)
  );
}

function getSortCandidates<T>(column: ColumnDef<T>): string[] {
  const candidates = new Set<string>();
  const accessor = typeof column.accessor === 'string' ? column.accessor : null;

  const include = (value: string | null | undefined) => {
    if (!value) {
      return;
    }
    candidates.add(value);
    candidates.add(toSnakeCase(value));
    candidates.add(toCamelCase(value));
  };

  include(column.key);
  include(accessor);

  return Array.from(candidates);
}

function resolveSortFieldForColumn<T>(
  column: ColumnDef<T>,
  currentSorts: SortSpec[],
  sortConfig: DataTableSortFieldConfig[],
): string | null {
  if (column.sortable === false) {
    return null;
  }

  const candidates = getSortCandidates(column);
  if (candidates.length === 0) {
    return null;
  }

  const activeSortFields = new Set(currentSorts.map((sort) => sort.field));
  for (const candidate of candidates) {
    if (activeSortFields.has(candidate)) {
      return candidate;
    }
  }

  const sortableFields = new Set(sortConfig.map((item) => item.field));
  for (const candidate of candidates) {
    if (sortableFields.has(candidate)) {
      return candidate;
    }
  }

  const normalizedHeader = normalizeLabel(column.header);
  const byHeader = sortConfig.find((item) => normalizeLabel(item.label) === normalizedHeader);
  return byHeader?.field ?? null;
}

export function createDataTableViewColumns<T>({
  columns,
  currentSorts,
  sortConfig,
  sortDisabled = false,
  getSortAriaLabel,
  getSortPriorityLabel,
  onSort,
}: {
  columns: ColumnDef<T>[];
  currentSorts: SortSpec[];
  sortConfig: DataTableSortFieldConfig[];
  sortDisabled?: boolean;
  getSortAriaLabel: (columnLabel: string) => string;
  getSortPriorityLabel?: (priority: number, total: number) => string;
  onSort: (field: string) => void;
}): DataTableViewColumn<T>[] {
  const sortMetaMap = new Map(
    currentSorts.map((sort, index) => [sort.field, { direction: sort.direction, order: index + 1 }]),
  );

  return columns.map((column) => {
    const sortField = resolveSortFieldForColumn(column, currentSorts, sortConfig);
    const sortMeta = sortField ? sortMetaMap.get(sortField) : undefined;

    return {
      key: column.key,
      header: column.header,
      width: column.width,
      minWidth: column.minWidth,
      kind: column.kind,
      renderCell: (row: T) => renderCellContent(row, column),
      sort: sortField
        ? {
            ariaLabel: getSortAriaLabel(column.header),
            direction: sortMeta?.direction,
            order: sortMeta?.order,
            showOrder: sortMetaMap.size > 1,
            description:
              sortMeta && sortMetaMap.size > 1 ? getSortPriorityLabel?.(sortMeta.order, sortMetaMap.size) : undefined,
            disabled: sortDisabled,
            onToggle: () => onSort(sortField),
          }
        : undefined,
    };
  });
}

export function cycleDataTableSorts({
  field,
  currentSorts,
  supportedSortFields,
  maxSorts,
}: {
  field: string;
  currentSorts: SortSpec[];
  supportedSortFields: ReadonlySet<string>;
  maxSorts: number;
}): SortSpec[] | null {
  const existingSort = currentSorts.find((sort) => sort.field === field);

  if (!existingSort) {
    if (!supportedSortFields.has(field) || currentSorts.length >= maxSorts) {
      return null;
    }
    return [...currentSorts, { field, direction: 'desc' }];
  }

  if (existingSort.direction === 'desc') {
    return currentSorts.map((sort) => (sort.field === field ? { ...sort, direction: 'asc' as const } : sort));
  }

  return currentSorts.filter((sort) => sort.field !== field);
}
