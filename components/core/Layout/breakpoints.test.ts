import { describe, expect, it } from 'vitest';
import { breakpointQuery } from './breakpoints';
describe('responsive boundary ownership', () => {
  it('keeps below and at-least ranges complementary', () => {
    expect(breakpointQuery('sm')).toBe('(width < 48em)');
    expect(breakpointQuery('sm', 'at-least')).toBe('(width >= 48em)');
    expect(() => breakpointQuery('phone' as 'sm')).toThrow(RangeError);
  });
});
