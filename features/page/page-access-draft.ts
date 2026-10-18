import { DEFAULT_PAGE_ACCESS_POLICY, type PageAccessPolicyValue } from '@/lib/types/page-access';

/** Membership opens the page to signed-in members; removing it makes the page public and clears every condition. */
export function setPageAccessMembership(draft: PageAccessPolicyValue, member: boolean): PageAccessPolicyValue {
  return member ? { ...draft, mode: 'authenticated' } : { ...DEFAULT_PAGE_ACCESS_POLICY };
}

/** Any role, tag or newsletter condition narrows access; with none left, access returns to membership alone. */
export function updatePageAccessConditions(
  draft: PageAccessPolicyValue,
  changes: Partial<PageAccessPolicyValue>,
): PageAccessPolicyValue {
  const next = { ...draft, ...changes };
  const hasConditions = next.roles.length > 0 || next.userTagIds.length > 0 || next.newsletterSubscriber;
  return { ...next, mode: hasConditions ? 'conditions' : 'authenticated' };
}

/** The policy to store: public and membership-only access keep no leftover conditions or match setting. */
export function canonicalPageAccessPolicy(value: PageAccessPolicyValue): PageAccessPolicyValue {
  return value.mode === 'conditions' ? value : { ...DEFAULT_PAGE_ACCESS_POLICY, mode: value.mode };
}
