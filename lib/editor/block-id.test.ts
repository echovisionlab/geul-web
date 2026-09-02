import { describe, expect, it } from 'vitest';
import { createBlockId, isBlockId } from './block-id';

describe('createBlockId', () => {
  it('creates unique UUID identities for durable document nodes', () => {
    const first = createBlockId();
    const second = createBlockId();

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    expect(second).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    expect(second).not.toBe(first);
  });
});

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
