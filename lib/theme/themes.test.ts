import { describe, expect, it } from 'vitest';
import { authoredEditorPalettes, primitiveTokens, semanticThemes } from '@echovisionlab/design-system/tokens';
import { themeVariables } from '@/theme';
import { getThemeDefinition, getThemeTokens, normalizeThemeId, themeDefinitions, themeIds } from './themes';

describe('review theme registry', () => {
  it('rejects unknown and prototype-derived URL values rather than exposing an arbitrary theme', () => {
    for (const value of [undefined, null, '', 'sepia', 'LIGHT', 'constructor', '__proto__', {}]) {
      expect(normalizeThemeId(value)).toBe('light');
      expect(getThemeDefinition(value).id).toBe('light');
    }
    expect(normalizeThemeId('unknown', 'dark')).toBe('dark');
    expect(normalizeThemeId('ocean-dark')).toBe('ocean-dark');
  });

  it('builds custom presets from the existing material palette without expanding tokens', () => {
    const paletteValues = Object.values(primitiveTokens.colors).flatMap((entry) =>
      typeof entry === 'string' ? [entry] : Object.values(entry),
    );
    for (const definition of themeDefinitions) {
      for (const value of Object.values(definition.overrides)) {
        expect(paletteValues).toContain(value);
      }
      expect(Object.keys(definition.overrides).length).toBeLessThan(Object.keys(semanticThemes.light).length);
    }
    expect(getThemeTokens('ocean-light').background).not.toBe(semanticThemes.light.background);
    expect(getThemeTokens('ocean-dark').surface).not.toBe(semanticThemes.dark.surface);
  });

  it.each(themeIds)('%s projects authored editor aliases through the same selected semantic roles', (id) => {
    const { base } = getThemeDefinition(id);
    const variables = themeVariables(id);
    for (const [name, value] of Object.entries(authoredEditorPalettes[base])) {
      expect(variables[`--editor-${name}`]).toBe(value);
    }
    expect(variables['--geul-text-on-image']).toBe(primitiveTokens.colors.white);
    expect(variables['--geul-paper-background']).toBe(primitiveTokens.colors.white);
  });
});
