import type { FilterOption } from '@/lib/types/common/data-table';
import {
  POST_TABLE_FILTER_FIELD_DEFINITIONS,
  POST_TABLE_SORT_FIELD_DEFINITIONS,
  type PostTableFilterField,
  type PostTableSortField,
} from '@/lib/types/post/table-spec';
import {
  buildFilterFieldConfigs,
  buildSortFieldConfigs,
  getDefaultFilterFields,
  getDefaultSortFields,
  parseEnabledFieldList,
} from '../table-field-spec';

export type { PostTableFilterField, PostTableSortField } from '@/lib/types/post/table-spec';
export { POST_TABLE_FILTER_FIELD_DEFINITIONS, POST_TABLE_SORT_FIELD_DEFINITIONS } from '@/lib/types/post/table-spec';

const POST_TABLE_STATUS_OPTIONS: FilterOption[] = [
  { value: 'POST_STATUS_PUBLISHED', label: 'Published' },
  { value: 'POST_STATUS_ARCHIVED', label: 'Archived' },
];

const POST_TABLE_SUPPORTED_FILTER_FIELDS = POST_TABLE_FILTER_FIELD_DEFINITIONS.map((definition) => definition.field);

const POST_TABLE_SUPPORTED_SORT_FIELDS = POST_TABLE_SORT_FIELD_DEFINITIONS.map((definition) => definition.field);

const DEFAULT_POST_TABLE_FILTER_FIELDS = getDefaultFilterFields(POST_TABLE_FILTER_FIELD_DEFINITIONS);
const DEFAULT_POST_TABLE_SORT_FIELDS = getDefaultSortFields(POST_TABLE_SORT_FIELD_DEFINITIONS);

interface PostTableFilterOptionInput {
  categories: FilterOption[];
  tags: FilterOption[];
  authors: FilterOption[];
  series: FilterOption[];
}

export function parsePostTableFilterFields(rawValue: string | undefined): PostTableFilterField[] {
  return parseEnabledFieldList(rawValue, POST_TABLE_SUPPORTED_FILTER_FIELDS, DEFAULT_POST_TABLE_FILTER_FIELDS);
}

export function parsePostTableSortFields(rawValue: string | undefined): PostTableSortField[] {
  return parseEnabledFieldList(rawValue, POST_TABLE_SUPPORTED_SORT_FIELDS, DEFAULT_POST_TABLE_SORT_FIELDS);
}

export function buildPostTableFilterFields(
  enabledFields: readonly PostTableFilterField[],
  options: PostTableFilterOptionInput,
) {
  return buildFilterFieldConfigs(POST_TABLE_FILTER_FIELD_DEFINITIONS, enabledFields, {
    category_id: options.categories,
    tag_id: options.tags,
    author_id: options.authors,
    series_id: options.series,
    status: POST_TABLE_STATUS_OPTIONS,
  });
}

export function buildPostTableSortFields(enabledFields: readonly PostTableSortField[]) {
  return buildSortFieldConfigs(POST_TABLE_SORT_FIELD_DEFINITIONS, enabledFields);
}
