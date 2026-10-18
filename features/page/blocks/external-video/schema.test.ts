import { describe, expect, it } from 'vitest';
import { parseExternalVideoProps } from './schema';

describe('parseExternalVideoProps', () => {
  it('rejects unsupported aspect ratios', () => {
    expect(() => parseExternalVideoProps({ aspectRatio: '21:9' })).toThrow();
  });
});
