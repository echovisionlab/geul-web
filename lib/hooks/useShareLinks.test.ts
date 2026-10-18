import { describe, expect, it } from 'vitest';
import { ensureShareLinkMutationSucceeded } from './share-link-mutation-result';

describe('ensureShareLinkMutationSucceeded', () => {
  it('propagates a rejected Post create result instead of reporting false success', () => {
    expect(() => ensureShareLinkMutationSucceeded({ error: 'No permission to create share link' })).toThrow(
      'No permission to create share link',
    );
  });
});
