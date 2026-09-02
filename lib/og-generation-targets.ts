// Site and legal documents use stable route identities in the lifecycle read API;
// callers never derive these from mutable content rows.
export const SITE_OG_TARGET_ID = 'default';

export const LEGAL_OG_TARGET_IDS = {
  privacy: '00000000-0000-0000-0000-000000000101',
  terms: '00000000-0000-0000-0000-000000000102',
} as const;

export type FixedOgTargetEntityType = 'site' | keyof typeof LEGAL_OG_TARGET_IDS;

export function getFixedOgTargetId(entityType: string): string | undefined {
  if (entityType === 'site') {
    return SITE_OG_TARGET_ID;
  }
  if (entityType === 'privacy' || entityType === 'terms') {
    return LEGAL_OG_TARGET_IDS[entityType];
  }
  return undefined;
}
