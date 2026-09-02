import type { ValueType } from '../common/filter';

// Filter/Sort field definitions for DataTable
export const clientFilterFields = {
  id: 'uuid',
  name: 'string',
  website: 'string',
  created_at: 'date',
} as const satisfies Record<string, ValueType>;

export const clientSortFields = ['name', 'created_at'] as const;

// Type matching the listClientsAdminAction return type
export interface ClientListItem {
  id: string;
  name: string;
  logoUrl: string | null;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  website: string | null;
  workCount: number;
  createdAt: Date | null;
}
