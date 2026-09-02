import { describe, expect, it } from 'vitest';
import { sanitizePageSlugInput, sanitizeSlugInput } from './slug';

describe('slug input sanitizers', () => {
  it('turns a slash into a separator for single-segment domain slugs', () => {
    expect(sanitizeSlugInput('abc/def')).toBe('abc-def');
  });

  it('keeps safe nested Page path segments', () => {
    expect(sanitizePageSlugInput('abc/def')).toBe('abc/def');
  });
});
