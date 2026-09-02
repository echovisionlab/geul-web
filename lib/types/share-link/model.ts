import type { ShareEntityType } from './schema';

export type { ShareEntityType };

// Repository/database types (snake_case)
export interface ShareLinkSelect {
  id: string;
  entity_type: ShareEntityType;
  entity_id: string;
  label: string | null;
  has_password: boolean;
  expires_at: Date;
  created_at: Date | null;
}

// UI types (camelCase, generic)
export interface ShareLink<T extends ShareEntityType = ShareEntityType> {
  id: string;
  entityType: T;
  entityId: string;
  label: string | null;
  hasPassword: boolean;
  expiresAt: Date;
  createdAt: Date | null;
  token: string;
  url: string;
}

// Expiration preset types
export type ExpirationPreset = '1h' | '6h' | '12h' | '24h' | '3d' | '7d' | '14d' | '30d' | '90d' | '1y' | 'custom';

export const EXPIRATION_PRESETS: Record<ExpirationPreset, { label: string; hours: number }> = {
  '1h': { label: '1 hour', hours: 1 },
  '6h': { label: '6 hours', hours: 6 },
  '12h': { label: '12 hours', hours: 12 },
  '24h': { label: '24 hours', hours: 24 },
  '3d': { label: '3 days', hours: 24 * 3 },
  '7d': { label: '7 days', hours: 24 * 7 },
  '14d': { label: '14 days', hours: 24 * 14 },
  '30d': { label: '30 days', hours: 24 * 30 },
  '90d': { label: '90 days', hours: 24 * 90 },
  '1y': { label: '1 year', hours: 24 * 365 },
  custom: { label: 'Custom', hours: 0 },
};
