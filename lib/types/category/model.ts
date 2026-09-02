import type { ValueType } from '../common/filter';

// Filter/Sort field definitions for DataTable
export const categoryFilterFields = {
  id: 'uuid',
  name: 'string',
  slug: 'string',
  description: 'string',
  created_at: 'date',
} as const satisfies Record<string, ValueType>;

export const categorySortFields = ['name', 'postCount', 'created_at'] as const;

export interface CategorySelect {
  id: string;
  name: string;
  slug: string | undefined;
  description?: string | null;
}

export interface CategoryWithPostCount extends CategorySelect {
  postCount: number;
  createdAt: Date | null;
}

export interface CategoryListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  postCount: number;
  createdAt: Date | null;
}
