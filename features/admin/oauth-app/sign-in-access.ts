import type { OAuthSignInAccess } from './model';

type FixedAccess = Exclude<OAuthSignInAccess, 'memberCriteria'>;

/** Picker values for the fixed choices; Member criteria options use their UUIDs. */
export const SIGN_IN_ACCESS_VALUES = {
  none: 'access:none',
  admins: 'access:admins',
  members: 'access:members',
} as const satisfies Record<FixedAccess, string>;

const ACCESS_BY_VALUE = new Map<string, FixedAccess>(
  Object.entries(SIGN_IN_ACCESS_VALUES).map(([access, value]) => [value, access as FixedAccess]),
);

export function signInAccessValues(access: OAuthSignInAccess, memberCriteriaIds: string[]): string[] {
  return access === 'memberCriteria' ? memberCriteriaIds : [SIGN_IN_ACCESS_VALUES[access]];
}

/**
 * Picking a fixed choice replaces the selection; picking Member criteria keeps only criteria. Clearing every
 * criteria falls back to nobody, so an app never admits more people than the Admin last chose.
 */
export function signInAccessChange(
  selected: string[],
  next: string[],
): { signInAccess: OAuthSignInAccess; memberCriteriaIds: string[] } {
  const added = next.find((value) => !selected.includes(value));
  const addedAccess = added ? ACCESS_BY_VALUE.get(added) : undefined;
  if (addedAccess) {
    return { signInAccess: addedAccess, memberCriteriaIds: [] };
  }
  const memberCriteriaIds = next.filter((value) => !ACCESS_BY_VALUE.has(value));
  return memberCriteriaIds.length === 0
    ? { signInAccess: 'none', memberCriteriaIds: [] }
    : { signInAccess: 'memberCriteria', memberCriteriaIds };
}
