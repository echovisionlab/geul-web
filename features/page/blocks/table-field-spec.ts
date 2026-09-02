import type { FilterFieldConfig, SortFieldConfig } from '@/features/data-table/ServerDataTable';
import type { FilterOption } from '@/lib/types/common/data-table';
import type { FilterOperator, ValueType } from '@/lib/types/common/filter';

export interface TableBlockFilterFieldDefinition<TField extends string> {
  field: TField;
  label: string;
  type: ValueType;
  operators: readonly FilterOperator[];
  defaultEnabled: boolean;
}

export interface TableBlockSortFieldDefinition<TField extends string> {
  field: TField;
  label: string;
  defaultEnabled: boolean;
}

export function parseEnabledFieldList<TField extends string>(
  rawValue: string | undefined,
  supportedFields: readonly TField[],
  defaultFields: readonly TField[],
): TField[] {
  const requested = rawValue
    ? rawValue
        .split(',')
        .map((value) => value.trim())
        .filter((value): value is TField => supportedFields.includes(value as TField))
    : [];

  const resolved = requested.length > 0 ? requested : [...defaultFields];
  return Array.from(new Set(resolved));
}

export function buildFilterFieldConfigs<TField extends string>(
  definitions: readonly TableBlockFilterFieldDefinition<TField>[],
  enabledFields: readonly TField[],
  optionMap: Partial<Record<TField, FilterOption[]>>,
): FilterFieldConfig[] {
  const enabledSet = new Set(enabledFields);

  return definitions
    .filter((definition) => enabledSet.has(definition.field))
    .map((definition) => ({
      field: definition.field,
      label: definition.label,
      type: definition.type,
      operators: [...definition.operators],
      options: optionMap[definition.field],
    }));
}

export function buildSortFieldConfigs<TField extends string>(
  definitions: readonly TableBlockSortFieldDefinition<TField>[],
  enabledFields: readonly TField[],
): SortFieldConfig[] {
  const enabledSet = new Set(enabledFields);

  return definitions
    .filter((definition) => enabledSet.has(definition.field))
    .map((definition) => ({
      field: definition.field,
      label: definition.label,
    }));
}

export function getDefaultFilterFields<TField extends string>(
  definitions: readonly TableBlockFilterFieldDefinition<TField>[],
): TField[] {
  return definitions.filter((definition) => definition.defaultEnabled).map((definition) => definition.field);
}

export function getDefaultSortFields<TField extends string>(
  definitions: readonly TableBlockSortFieldDefinition<TField>[],
): TField[] {
  return definitions.filter((definition) => definition.defaultEnabled).map((definition) => definition.field);
}
