import type { ValueType } from '../common/filter';

// Filter/Sort field definitions for DataTable
export const formatFilterFields = {
  id: 'uuid',
  name: 'string',
  slug: 'string',
} as const satisfies Record<string, ValueType>;

export const formatSortFields = ['name', 'releaseCount', 'sort_order'] as const;

export interface FormatSelect {
  id: string;
  name: string;
  slug: string;
  sort_order: number | null;
}

export interface FormatWithReleaseCount extends FormatSelect {
  releaseCount: number;
}

export interface FormatListItem {
  id: string;
  name: string;
  slug: string;
  releaseCount: number;
}
