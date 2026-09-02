import { describe, expect, it } from 'vitest';
import { DEFAULT_LIGHT_VARIANT, DEFAULT_THEME_SETTINGS } from '@/lib/types/map-theme/schema';
import { buildResolvedThemeConfig, resolveMapLabelVisibility } from './map-theme';

describe('resolveMapLabelVisibility', () => {
  it('inherits the theme default when mode is inherit or undefined', () => {
    expect(resolveMapLabelVisibility(undefined, true)).toBe(true);
    expect(resolveMapLabelVisibility('inherit', false)).toBe(false);
  });

  it('can force labels on regardless of the theme default', () => {
    expect(resolveMapLabelVisibility('show', false)).toBe(true);
  });

  it('can force labels off regardless of the theme default', () => {
    expect(resolveMapLabelVisibility('hide', true)).toBe(false);
  });
});

describe('buildResolvedThemeConfig', () => {
  it('uses the resolved variant exactly without inventing a counterpart or color fallback', () => {
    const { scheme: _scheme, ...variant } = DEFAULT_LIGHT_VARIANT;
    const resolved = buildResolvedThemeConfig({
      settings: DEFAULT_THEME_SETTINGS,
      variant: { ...variant, calloutBackgroundColor: 'transparent' },
      scheme: 'light',
    });

    expect(resolved.calloutBackgroundColor).toBe('transparent');
    expect(resolved).not.toHaveProperty('darkVariant');
  });
});
