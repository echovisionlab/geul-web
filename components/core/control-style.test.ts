import { describe, expect, it } from 'vitest';
import { resolveControlStyle } from './control-style';

describe('resolveControlStyle', () => {
  it('maps semantic emphasis to the shared visual treatments', () => {
    expect(resolveControlStyle('accent', 'strong')).toEqual({ color: 'blue', variant: 'filled' });
    expect(resolveControlStyle('positive', 'medium')).toEqual({ color: 'teal', variant: 'light' });
    expect(resolveControlStyle('danger', 'low')).toEqual({ color: 'red', variant: 'subtle' });
    expect(resolveControlStyle('warning', 'outline')).toEqual({
      color: 'yellow',
      variant: 'outline',
    });
  });

  it('uses the default treatment for neutral medium and outline controls', () => {
    expect(resolveControlStyle('neutral', 'medium')).toEqual({
      color: undefined,
      variant: 'default',
    });
    expect(resolveControlStyle('neutral', 'outline')).toEqual({
      color: undefined,
      variant: 'default',
    });
  });
});
