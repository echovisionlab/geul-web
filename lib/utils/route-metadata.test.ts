import { describe, expect, it } from 'vitest';
import { withNoIndex } from './route-metadata';

describe('withNoIndex', () => {
  it('prevents referrer leakage by default', () => {
    expect(withNoIndex({ title: 'Preview' })).toMatchObject({
      referrer: 'no-referrer',
      robots: {
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
          noimageindex: true,
        },
      },
    });
  });

  it('preserves an explicit caller referrer policy', () => {
    expect(withNoIndex({ referrer: 'same-origin' }).referrer).toBe('same-origin');
  });
});
