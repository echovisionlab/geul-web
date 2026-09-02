import type { FilterOption } from '@/lib/types/common/data-table';
import type { FilterOperator, ValueType } from '@/lib/types/common/filter';

export interface FilterFieldConfig {
  field: string;
  label: string;
  type: ValueType;
  options?: FilterOption[];
  operators?: FilterOperator[];
}

export interface ActiveFilter {
  field: string;
  op: FilterOperator;
  value: unknown;
  negated?: boolean;
}

export interface FilterEditState {
  op: FilterOperator;
  value: unknown;
  negated: boolean;
}

export function formatActiveFilterValue(filter: ActiveFilter, fieldConfig: FilterFieldConfig | undefined): string {
  if (!fieldConfig) {
    return String(filter.value);
  }
  if (filter.op === 'isNull' || filter.op === 'isEmpty') {
    return '';
  }
  if (filter.op === 'in' && Array.isArray(filter.value)) {
    return filter.value
      .map((value) => fieldConfig.options?.find((option) => option.value === value)?.label ?? value)
      .join(', ');
  }
  if (filter.op === 'between' && Array.isArray(filter.value)) {
    return `${filter.value[0]} ~ ${filter.value[1]}`;
  }
  return String(filter.value);
}
