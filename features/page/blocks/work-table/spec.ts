import type { FilterOption } from '@/lib/types/common/data-table';
import { WORK_TYPE_FILTER_VALUES, WORK_TYPE_LABELS, WORK_TYPES, type WorkType } from '@/lib/types/work/model';
import {
  WORK_TABLE_FILTER_FIELD_DEFINITIONS,
  WORK_TABLE_SORT_FIELD_DEFINITIONS,
  type WorkTableFilterField,
  type WorkTableSortField,
} from '@/lib/types/work/table-spec';
import {
  buildFilterFieldConfigs,
  buildSortFieldConfigs,
  getDefaultFilterFields,
  getDefaultSortFields,
  parseEnabledFieldList,
  type TableBlockFilterFieldDefinition,
  type TableBlockSortFieldDefinition,
} from '../table-field-spec';

export type { WorkTableFilterField, WorkTableSortField } from '@/lib/types/work/table-spec';
export { WORK_TABLE_FILTER_FIELD_DEFINITIONS, WORK_TABLE_SORT_FIELD_DEFINITIONS } from '@/lib/types/work/table-spec';

export interface WorkTableLabelOverrides {
  fieldLabels?: Partial<Record<WorkTableFilterField | WorkTableSortField, string>>;
  statusOptionLabels?: {
    published?: string;
    archived?: string;
  };
  typeOptionLabels?: Partial<Record<WorkType, string>>;
}

function getResolvedStatusOptions(overrides?: WorkTableLabelOverrides): FilterOption[] {
  return [
    {
      value: 'WORK_STATUS_PUBLISHED',
      label: overrides?.statusOptionLabels?.published ?? 'Published',
    },
    {
      value: 'WORK_STATUS_ARCHIVED',
      label: overrides?.statusOptionLabels?.archived ?? 'Archived',
    },
  ];
}

function getResolvedTypeFilterOptions(overrides?: WorkTableLabelOverrides): FilterOption[] {
  return WORK_TYPES.map((type: WorkType) => ({
    value: WORK_TYPE_FILTER_VALUES[type],
    label: overrides?.typeOptionLabels?.[type] ?? WORK_TYPE_LABELS[type],
  }));
}

export function getWorkTableEditorTypeOptions(overrides?: WorkTableLabelOverrides): FilterOption[] {
  return WORK_TYPES.map((type: WorkType) => ({
    value: type,
    label: overrides?.typeOptionLabels?.[type] ?? WORK_TYPE_LABELS[type],
  }));
}

export function getWorkTableStatusOptions(overrides?: WorkTableLabelOverrides): FilterOption[] {
  return getResolvedStatusOptions(overrides);
}

export function getWorkTableFilterFieldDefinitions(
  overrides?: WorkTableLabelOverrides,
): TableBlockFilterFieldDefinition<WorkTableFilterField>[] {
  return WORK_TABLE_FILTER_FIELD_DEFINITIONS.map((definition) => ({
    ...definition,
    label: overrides?.fieldLabels?.[definition.field] ?? definition.label,
  }));
}

export function getWorkTableSortFieldDefinitions(
  overrides?: WorkTableLabelOverrides,
): TableBlockSortFieldDefinition<WorkTableSortField>[] {
  return WORK_TABLE_SORT_FIELD_DEFINITIONS.map((definition) => ({
    ...definition,
    label: overrides?.fieldLabels?.[definition.field] ?? definition.label,
  }));
}

const WORK_TABLE_SUPPORTED_FILTER_FIELDS = WORK_TABLE_FILTER_FIELD_DEFINITIONS.map((definition) => definition.field);

const WORK_TABLE_SUPPORTED_SORT_FIELDS = WORK_TABLE_SORT_FIELD_DEFINITIONS.map((definition) => definition.field);

const DEFAULT_WORK_TABLE_FILTER_FIELDS = getDefaultFilterFields(WORK_TABLE_FILTER_FIELD_DEFINITIONS);
const DEFAULT_WORK_TABLE_SORT_FIELDS = getDefaultSortFields(WORK_TABLE_SORT_FIELD_DEFINITIONS);

export function parseWorkTableFilterFields(rawValue: string | undefined): WorkTableFilterField[] {
  return parseEnabledFieldList(rawValue, WORK_TABLE_SUPPORTED_FILTER_FIELDS, DEFAULT_WORK_TABLE_FILTER_FIELDS);
}

export function parseWorkTableSortFields(rawValue: string | undefined): WorkTableSortField[] {
  return parseEnabledFieldList(rawValue, WORK_TABLE_SUPPORTED_SORT_FIELDS, DEFAULT_WORK_TABLE_SORT_FIELDS);
}

export function buildWorkTableFilterFields(
  enabledFields: readonly WorkTableFilterField[],
  overrides?: WorkTableLabelOverrides,
) {
  return buildFilterFieldConfigs(getWorkTableFilterFieldDefinitions(overrides), enabledFields, {
    type: getResolvedTypeFilterOptions(overrides),
    status: getResolvedStatusOptions(overrides),
  });
}

export function buildWorkTableSortFields(
  enabledFields: readonly WorkTableSortField[],
  overrides?: WorkTableLabelOverrides,
) {
  return buildSortFieldConfigs(getWorkTableSortFieldDefinitions(overrides), enabledFields);
}
