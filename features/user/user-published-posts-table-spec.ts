import type { FilterFieldConfig, SortFieldConfig } from '@/features/data-table/ServerDataTable';
import type { FilterOption } from '@/lib/types/common/data-table';
import {
  USER_PUBLISHED_POST_FILTER_DEFINITIONS,
  USER_PUBLISHED_POST_SORT_DEFINITIONS,
} from '@/lib/types/user/table-spec';

interface UserPublishedPostsFilterOptionInput {
  categories: FilterOption[];
  tags: FilterOption[];
}

interface UserPublishedPostsLabelInput {
  category: string;
  tag: string;
  title: string;
  published: string;
}

export {
  USER_PUBLISHED_POST_ALLOWED_FILTER_FIELDS,
  USER_PUBLISHED_POST_ALLOWED_SORT_FIELDS,
} from '@/lib/types/user/table-spec';

export function buildUserPublishedPostsFilterFields(
  options: UserPublishedPostsFilterOptionInput,
  labels: Pick<UserPublishedPostsLabelInput, 'category' | 'tag'>,
): FilterFieldConfig[] {
  return USER_PUBLISHED_POST_FILTER_DEFINITIONS.map((definition) => ({
    field: definition.field,
    label: definition.field === 'category_id' ? labels.category : labels.tag,
    type: 'uuid',
    operators: [...definition.operators],
    options: definition.field === 'category_id' ? options.categories : options.tags,
  }));
}

export function buildUserPublishedPostsSortFields(
  labels: Pick<UserPublishedPostsLabelInput, 'title' | 'published'>,
): SortFieldConfig[] {
  return USER_PUBLISHED_POST_SORT_DEFINITIONS.map((definition) => ({
    field: definition.field,
    label: definition.field === 'title' ? labels.title : labels.published,
  }));
}
