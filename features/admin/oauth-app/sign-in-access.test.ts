import { describe, expect, it } from 'vitest';
import { SIGN_IN_ACCESS_VALUES, signInAccessChange, signInAccessValues } from './sign-in-access';

describe('sign-in access picker', () => {
  const criteria = ['a3f6c1d2-0b4e-4f7a-9c8d-1e2f3a4b5c6d', 'b7e8f9a0-1c2d-4e3f-8a9b-0c1d2e3f4a5b'];

  it('replaces Member criteria with a fixed choice', () => {
    expect(signInAccessChange(criteria, [...criteria, SIGN_IN_ACCESS_VALUES.admins])).toEqual({
      signInAccess: 'admins',
      memberCriteriaIds: [],
    });
  });

  it('replaces a fixed choice with the Member criteria picked next', () => {
    const selected = signInAccessValues('members', []);
    expect(signInAccessChange(selected, [...selected, criteria[0]])).toEqual({
      signInAccess: 'memberCriteria',
      memberCriteriaIds: [criteria[0]],
    });
  });

  it('admits nobody once every Member criteria is cleared', () => {
    expect(signInAccessChange(criteria, [])).toEqual({ signInAccess: 'none', memberCriteriaIds: [] });
  });
});
