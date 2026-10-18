import { describe, expect, it } from 'vitest';
import { isBlockId } from './block-id';

describe('isBlockId', () => {
  it('accepts runtime UUIDs and deterministic migration UUIDs', () => {
    expect(isBlockId('01b3db42-75f1-4bf1-8cb9-9b3baf57e795')).toBe(true);
    expect(isBlockId('b67328c4-668c-5bf2-8f1e-41465149ded6')).toBe(true);
  });

  it('rejects legacy and malformed identities', () => {
    expect(isBlockId('legacy-block')).toBe(false);
    expect(isBlockId('')).toBe(false);
    expect(isBlockId(undefined)).toBe(false);
  });
});
