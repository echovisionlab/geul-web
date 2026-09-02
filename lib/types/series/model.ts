import type { ValueType } from '../common/filter';

export type SeriesStatus = 'draft' | 'published';

// Filter/Sort field definitions for DataTable
export const seriesFilterFields = {
  id: 'uuid',
  title: 'string',
  slug: 'string',
  status: 'string',
  created_at: 'date',
} as const satisfies Record<string, ValueType>;

export const seriesSortFields = ['title', 'post_count', 'created_at', 'status'] as const;

// Type matching the listSeriesAdminAction return type
export interface SeriesListItem {
  id: string;
  title: string;
  slug: string;
  description?: string;
  status: string;
  postCount: number;
  managerCount: number;
  createdAt: Date | undefined;
  updatedAt: Date | undefined;
}

export interface SeriesSelect {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface SeriesBasic {
  id: string;
  title: string;
  slug: string;
}

export interface SeriesWithPostCount extends SeriesSelect {
  post_count: number;
}

export interface CreateSeriesInput {
  title: string;
  slug: string;
  description?: string | null;
}

export interface UpdateSeriesInput {
  title?: string;
  slug?: string;
  description?: string | null;
  status?: SeriesStatus;
}
