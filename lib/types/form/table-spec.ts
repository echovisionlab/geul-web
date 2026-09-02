import type { ValueType } from '../common/filter';

export const formFilterFields = {
  id: 'uuid',
  title: 'string',
  slug: 'string',
  status: 'string',
  is_public: 'boolean',
  created_at: 'date',
} as const satisfies Record<string, ValueType>;

export const formSortFields = ['title', 'created_at', 'status'] as const;
