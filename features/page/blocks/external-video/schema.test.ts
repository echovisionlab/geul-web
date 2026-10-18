import { describe, expect, it } from 'vitest';
import { parseExternalVideoProps } from './schema';

describe('parseExternalVideoProps', () => {
  it('applies the shared contract defaults', () => {
    expect(parseExternalVideoProps({})).toEqual({
      url: '',
      caption: '',
      aspectRatio: 'auto',
    });
  });

  it('rejects unsupported aspect ratios', () => {
    expect(() => parseExternalVideoProps({ aspectRatio: '21:9' })).toThrow();
  });
});
