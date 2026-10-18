import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_ACCESS_POLICY, type PageAccessPolicyValue } from '@/lib/types/page-access';
import { canonicalPageAccessPolicy, setPageAccessMembership, updatePageAccessConditions } from './page-access-draft';

const membersOnly: PageAccessPolicyValue = { ...DEFAULT_PAGE_ACCESS_POLICY, mode: 'authenticated' };

describe('page access draft', () => {
  it('saves membership alone as authenticated and none selected as public', () => {
    const member = setPageAccessMembership(DEFAULT_PAGE_ACCESS_POLICY, true);

    expect(canonicalPageAccessPolicy(member)).toEqual(membersOnly);
    expect(canonicalPageAccessPolicy(setPageAccessMembership(member, false))).toEqual(DEFAULT_PAGE_ACCESS_POLICY);
  });

  it('clears every narrowing condition when membership is unchecked', () => {
    const narrowed: PageAccessPolicyValue = {
      mode: 'conditions',
      match: 'all',
      roles: ['admin'],
      userTagIds: ['tag-a'],
      newsletterSubscriber: true,
    };

    expect(setPageAccessMembership(narrowed, false)).toEqual(DEFAULT_PAGE_ACCESS_POLICY);
  });

  it.each<[string, Partial<PageAccessPolicyValue>]>([
    ['the newsletter', { newsletterSubscriber: true }],
    ['a member tag', { userTagIds: ['tag-a'] }],
  ])('selects membership through %s condition without storing a broad member role', (_, changes) => {
    const next = updatePageAccessConditions(DEFAULT_PAGE_ACCESS_POLICY, changes);

    expect(next).toEqual({ ...DEFAULT_PAGE_ACCESS_POLICY, mode: 'conditions', ...changes });
    expect(canonicalPageAccessPolicy(next)).toEqual(next);
  });

  it('returns to membership-only access without a leftover match when the last condition is removed', () => {
    const newsletterOnly: PageAccessPolicyValue = {
      ...DEFAULT_PAGE_ACCESS_POLICY,
      mode: 'conditions',
      match: 'all',
      newsletterSubscriber: true,
    };
    const next = updatePageAccessConditions(newsletterOnly, { newsletterSubscriber: false });

    expect(next.mode).toBe('authenticated');
    expect(canonicalPageAccessPolicy(next)).toEqual(membersOnly);
  });
});
