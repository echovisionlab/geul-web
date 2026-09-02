import type { ValueType } from '../common/filter';

// Filter/Sort field definitions for DataTable
export const genreFilterFields = {
  id: 'uuid',
  name: 'string',
  slug: 'string',
  description: 'string',
  created_at: 'date',
} as const satisfies Record<string, ValueType>;

export const genreSortFields = ['name', 'releaseCount', 'sort_order', 'created_at'] as const;

export interface GenreSelect {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number | null;
}

export interface GenreWithReleaseCount extends GenreSelect {
  releaseCount: number;
  createdAt: Date | null;
}

export interface GenreListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  releaseCount: number;
  createdAt: Date | null;
}
