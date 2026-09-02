import { describe, expect, it } from 'vitest';
import { toTrackCreditMutationInput } from './track-credit-mutation';

describe('toTrackCreditMutationInput', () => {
  it('omits a new empty id, preserves persisted ids, and derives order from the array', () => {
    const result = toTrackCreditMutationInput([
      {
        id: '',
        credit_type: 'text',
        credited_name: 'New',
        credit_role: null,
        artist_id: null,
        artist_name: null,
        artist_slug: null,
        member_id: null,
        member_name: null,
        sort_order: 9,
      },
      {
        id: 'credit-1',
        credit_type: 'text',
        credited_name: 'Existing',
        credit_role: null,
        artist_id: null,
        artist_name: null,
        artist_slug: null,
        member_id: null,
        member_name: null,
        sort_order: 0,
      },
    ]);

    expect(result.map((credit) => credit.id)).toEqual([undefined, 'credit-1']);
    expect(result.map((credit) => credit.sort_order)).toEqual([0, 1]);
  });
});
