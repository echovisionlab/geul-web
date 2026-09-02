import type { FilterOperator, ValueType } from '../common/filter';

export type WorkTableFilterField =
  'type' | 'featured' | 'status' | 'year' | 'month' | 'until_year' | 'until_month' | 'is_present' | 'published_at';
export type WorkTableSortField = 'published_at' | 'updated_at' | 'title';

interface WorkTableFilterDefinition {
  field: WorkTableFilterField;
  label: string;
  type: ValueType;
  operators: readonly FilterOperator[];
  defaultEnabled: boolean;
}

interface WorkTableSortDefinition {
  field: WorkTableSortField;
  label: string;
  defaultEnabled: boolean;
}

export const WORK_TABLE_FILTER_FIELD_DEFINITIONS = [
  { field: 'type', label: 'Type', type: 'string', operators: ['in'], defaultEnabled: true },
  { field: 'featured', label: 'Featured', type: 'boolean', operators: ['eq'], defaultEnabled: true },
  { field: 'status', label: 'Status', type: 'string', operators: ['in'], defaultEnabled: true },
  { field: 'year', label: 'Year', type: 'number', operators: ['eq', 'gte', 'lte', 'between'], defaultEnabled: true },
  { field: 'month', label: 'Month', type: 'number', operators: ['eq', 'gte', 'lte', 'between'], defaultEnabled: false },
  {
    field: 'until_year',
    label: 'Until Year',
    type: 'number',
    operators: ['eq', 'gte', 'lte', 'between'],
    defaultEnabled: false,
  },
  {
    field: 'until_month',
    label: 'Until Month',
    type: 'number',
    operators: ['eq', 'gte', 'lte', 'between'],
    defaultEnabled: false,
  },
  { field: 'is_present', label: 'Present', type: 'boolean', operators: ['eq'], defaultEnabled: false },
  {
    field: 'published_at',
    label: 'Published',
    type: 'date',
    operators: ['eq', 'gte', 'lte', 'between'],
    defaultEnabled: true,
  },
] as const satisfies readonly WorkTableFilterDefinition[];

export const WORK_TABLE_SORT_FIELD_DEFINITIONS = [
  { field: 'published_at', label: 'Published', defaultEnabled: true },
  { field: 'updated_at', label: 'Updated', defaultEnabled: true },
  { field: 'title', label: 'Title', defaultEnabled: true },
] as const satisfies readonly WorkTableSortDefinition[];

export const workFilterFields = {
  id: 'uuid',
  title: 'string',
  slug: 'string',
  type: 'string',
  status: 'string',
  featured: 'boolean',
  map_place_id: 'uuid',
  year: 'number',
  month: 'number',
  until_year: 'number',
  until_month: 'number',
  is_present: 'boolean',
  created_at: 'date',
  updated_at: 'date',
  published_at: 'date',
} as const satisfies Record<string, ValueType>;

export const workSortFields = [
  'title',
  'type',
  'status',
  'sort_order',
  'created_at',
  'updated_at',
  'published_at',
] as const;

export const myWorkFilterFields = {
  title: 'string',
  type: 'string',
  status: 'string',
} as const satisfies Record<string, ValueType>;

export const myWorkSortFields = ['title', 'type', 'created_at', 'updated_at'] as const;

export const myCreditedWorkFilterFields = {
  title: 'string',
  type: 'string',
  status: 'string',
} as const satisfies Record<string, ValueType>;

export const myCreditedWorkSortFields = ['title', 'type', 'created_at'] as const;
