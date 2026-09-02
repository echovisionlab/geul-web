import { describe, expect, it } from 'vitest';
import { extractChangedFields } from './form-diff';

describe('extractChangedFields', () => {
  it('returns only changed scalar fields', () => {
    expect(
      extractChangedFields(
        { title: 'Before', isPublic: false, count: 1 },
        { title: 'After', isPublic: false, count: 2 },
      ),
    ).toEqual({
      title: 'After',
      count: 2,
    });
  });

  it('uses deep equality for object and array values', () => {
    expect(
      extractChangedFields(
        {
          metadata: { title: 'Hello', locale: 'en' },
          tags: ['a', 'b'],
        },
        {
          metadata: { title: 'Hello', locale: 'en' },
          tags: ['a', 'b', 'c'],
        },
      ),
    ).toEqual({
      tags: ['a', 'b', 'c'],
    });
  });

  it('does not report keys that are unchanged or absent from the current payload', () => {
    expect(
      extractChangedFields(
        {
          title: 'Hello',
          description: 'World',
          metadata: null as { updatedBy: string } | null,
        },
        {
          title: 'Hello',
          metadata: null,
        },
      ),
    ).toEqual({});
  });
});
