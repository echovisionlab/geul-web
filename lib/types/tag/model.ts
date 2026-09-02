import type { ValueType } from '../common/filter';

// Filter/Sort field definitions for DataTable
export const tagFilterFields = {
  id: 'uuid',
  name: 'string',
  slug: 'string',
  created_at: 'date',
} as const satisfies Record<string, ValueType>;

export const tagSortFields = ['name', 'postCount', 'created_at'] as const;

export interface TagSelect {
  id: string;
  name: string;
  slug: string | undefined;
}

export interface TagWithPostCount extends TagSelect {
  postCount: number;
  createdAt: Date | null;
}

export interface TagListItem {
  id: string;
  name: string;
  slug: string;
  postCount: number;
  createdAt: Date | null;
}
