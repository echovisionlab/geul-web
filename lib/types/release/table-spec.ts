import type { ValueType } from '../common/filter';

export const releaseFilterFields = {
  id: 'uuid',
  title: 'string',
  slug: 'string',
  type: 'string',
  status: 'string',
  release_date: 'date',
  created_at: 'date',
} as const satisfies Record<string, ValueType>;

export const releaseSortFields = ['title', 'release_date', 'created_at', 'type', 'status'] as const;
