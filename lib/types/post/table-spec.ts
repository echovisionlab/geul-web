import type { FilterOperator, ValueType } from '@/lib/types/common/filter';

export type PostTableFilterField = 'category_id' | 'tag_id' | 'author_id' | 'series_id' | 'status' | 'published_at';
export type PostTableSortField = 'published_at' | 'title';

export interface PostTableFilterDefinition {
  field: PostTableFilterField;
  label: string;
  type: ValueType;
  operators: readonly FilterOperator[];
  defaultEnabled: boolean;
}

export interface PostTableSortDefinition {
  field: PostTableSortField;
  label: string;
  defaultEnabled: boolean;
}

export const POST_TABLE_FILTER_FIELD_DEFINITIONS = [
  { field: 'category_id', label: 'Category', type: 'uuid', operators: ['in'], defaultEnabled: true },
  { field: 'tag_id', label: 'Tag', type: 'uuid', operators: ['in'], defaultEnabled: true },
  { field: 'author_id', label: 'Author', type: 'uuid', operators: ['in'], defaultEnabled: true },
  { field: 'series_id', label: 'Series', type: 'uuid', operators: ['in'], defaultEnabled: true },
  { field: 'status', label: 'Status', type: 'string', operators: ['in'], defaultEnabled: true },
  {
    field: 'published_at',
    label: 'Published',
    type: 'date',
    operators: ['eq', 'gte', 'lte', 'between'],
    defaultEnabled: true,
  },
] as const satisfies readonly PostTableFilterDefinition[];

export const POST_TABLE_SORT_FIELD_DEFINITIONS = [
  { field: 'published_at', label: 'Published', defaultEnabled: true },
  { field: 'title', label: 'Title', defaultEnabled: true },
] as const satisfies readonly PostTableSortDefinition[];
