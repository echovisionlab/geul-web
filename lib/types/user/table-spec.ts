import type { FilterOperator, ValueType } from '../common/filter';

export type UserPublishedPostFilterField = 'category_id' | 'tag_id';
export type UserPublishedPostSortField = 'title' | 'published_at';

export const USER_PUBLISHED_POST_FILTER_DEFINITIONS = [
  { field: 'category_id', label: 'Category', operators: ['in'] },
  { field: 'tag_id', label: 'Tag', operators: ['in'] },
] as const;

export const USER_PUBLISHED_POST_SORT_DEFINITIONS = [
  { field: 'published_at', label: 'Published' },
  { field: 'title', label: 'Title' },
] as const;

export const USER_PUBLISHED_POST_ALLOWED_FILTER_FIELDS: ReadonlyArray<{
  field: string;
  operators: readonly FilterOperator[];
}> = USER_PUBLISHED_POST_FILTER_DEFINITIONS.map(({ field, operators }) => ({ field, operators }));

export const USER_PUBLISHED_POST_ALLOWED_SORT_FIELDS: ReadonlyArray<{ field: string }> =
  USER_PUBLISHED_POST_SORT_DEFINITIONS.map(({ field }) => ({ field }));

export const userFilterFields = {
  id: 'uuid',
  nickname: 'string',
  email: 'string',
  role: 'string',
  banned: 'boolean',
  newsletter_subscribed: 'boolean',
  created_at: 'date',
} as const satisfies Record<string, ValueType>;

export const userSortFields = ['role', 'newsletter_subscribed', 'created_at'] as const;
