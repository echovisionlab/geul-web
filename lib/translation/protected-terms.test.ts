import { describe, expect, it } from 'vitest';
import { normalizeProtectedTerms } from './protected-terms';

describe('normalizeProtectedTerms', () => {
  it('trims, removes exact duplicates, and preserves fixed spelling and case', () => {
    expect(normalizeProtectedTerms([' Photoshop ', 'Photoshop', 'photoshop', ' React Native ', '', '   '])).toEqual([
      'Photoshop',
      'photoshop',
      'React Native',
    ]);
  });
});
