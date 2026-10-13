import { describe, expect, it } from 'vitest';
import { themeVariables, theme } from './theme';
import { primitiveTokens, semanticThemes } from './components/core/design-tokens';
import { getThemeDefinition, getThemeTokens, themeIds } from './lib/theme/themes';

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => {
      const channel = parseInt(value, 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('design token contract', () => {
  it('keeps the same role coverage in both themes', () => {
    expect(Object.keys(semanticThemes.light).sort()).toEqual(Object.keys(semanticThemes.dark).sort());
  });

  it.each(themeIds)('%s keeps text, action labels, and feedback readable across surface states', (mode) => {
    const roles = getThemeTokens(mode);
    for (const surface of ['background', 'surface', 'surface-muted', 'surface-hover', 'surface-active'] as const) {
      for (const foreground of [
        'text-primary',
        'text-secondary',
        'text-muted',
        'action-ink',
        'action-ink-muted',
        'status-accent',
        'status-positive',
        'status-warning',
        'status-danger',
      ] as const) {
        expect(
          contrast(roles[foreground], roles[surface]),
          `${mode} ${foreground} on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(roles.focus, roles[surface]), `${mode} focus on ${surface}`).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(themeIds)('%s keeps action labels readable while hovered and pressed', (mode) => {
    const roles = getThemeTokens(mode);
    // Unfilled hover/pressed commands use surface-hover/surface-active, covered by the surface-state test above.
    for (const fill of [
      'action-primary',
      'action-primary-hover',
      'action-primary-pressed',
      'action-accent',
      'action-accent-hover',
      'action-accent-pressed',
      'action-positive',
      'action-positive-hover',
      'action-positive-pressed',
      'action-warning',
      'action-warning-hover',
      'action-warning-pressed',
      'action-danger',
      'action-danger-hover',
      'action-danger-pressed',
    ] as const) {
      expect(contrast(roles['text-on-action'], roles[fill]), `${mode} label on ${fill}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(themeIds)('%s preserves meaningful control outlines and selected checkmarks', (mode) => {
    const roles = getThemeTokens(mode);
    // Checkbox/radio outlines and slider tracks use this role on these surfaces.
    // Decorative card boundaries do not identify controls and need no contrast gate.
    for (const surface of ['background', 'surface', 'surface-muted'] as const) {
      expect(
        contrast(roles['border-strong'], roles[surface]),
        `${mode} control outline on ${surface}`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrast(roles['action-boundary'], roles[surface]),
        `${mode} outlined command on ${surface}`,
      ).toBeGreaterThanOrEqual(3);
    }
    expect(
      contrast(roles['text-on-action'], roles['text-primary']),
      `${mode} selected checkmark`,
    ).toBeGreaterThanOrEqual(3);
  });

  it.each(themeIds)('%s keeps independently chosen document colors readable', (mode) => {
    const roles = getThemeTokens(mode);
    const families = [
      'default',
      'gray',
      'brown',
      'red',
      'orange',
      'yellow',
      'green',
      'blue',
      'purple',
      'pink',
    ] as const;
    for (const foreground of families) {
      for (const background of families) {
        // Transparent document highlights inherit either supported page surface.
        const surfaces =
          background === 'default' ? [roles.background, roles.surface] : [roles[`document-background-${background}`]];
        for (const surface of surfaces) {
          expect(
            contrast(roles[`document-text-${foreground}`], surface),
            `${mode} document ${foreground} on ${background} (${surface})`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('preserves the logo red separately from interaction colors', () => {
    expect(primitiveTokens.colors.brand).toBe('#b02d23');
    expect(primitiveTokens.colors.red[500]).toBe(primitiveTokens.colors.brand);
    expect(theme.palette).toBe(primitiveTokens.colors);
    for (const mode of ['light', 'dark'] as const) {
      expect(semanticThemes[mode]['action-ink']).not.toBe(primitiveTokens.colors.brand);
      expect(semanticThemes[mode]['action-primary']).not.toBe(primitiveTokens.colors.brand);
    }
  });

  it('keeps every named color grade ordered from light to dark', () => {
    for (const family of ['neutral', 'graphite', 'red', 'green', 'blue', 'yellow', 'orange'] as const) {
      const ramp = primitiveTokens.colors[family];
      expect(Object.keys(ramp).map(Number)).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900]);
      const values = Object.values(ramp);
      for (let index = 1; index < values.length; index++) {
        expect(luminance(values[index]), `${family} grade ${Object.keys(ramp)[index]}`).toBeLessThan(
          luminance(values[index - 1]),
        );
      }
    }
  });

  it('retains the reviewed functional colors without adding another warning meaning', () => {
    expect(primitiveTokens.colors.green[500]).toBe('#287a3f');
    expect(primitiveTokens.colors.blue[500]).toBe('#235f96');
    expect(primitiveTokens.colors.yellow[500]).toBe('#d5a900');
    expect(primitiveTokens.colors.orange[500]).toBe('#ce5526');
    for (const mode of ['light', 'dark'] as const) {
      expect(Object.values(primitiveTokens.colors.yellow)).toContain(semanticThemes[mode]['status-warning']);
      for (const role of ['status-accent', 'status-positive', 'status-warning', 'status-danger'] as const) {
        expect(Object.values(primitiveTokens.colors.orange)).not.toContain(semanticThemes[mode][role]);
      }
    }
  });

  it('projects canonical roles without a second set of definitions', () => {
    for (const themeId of themeIds) {
      const variables = themeVariables(themeId);
      const { base } = getThemeDefinition(themeId);
      for (const [name, value] of Object.entries(getThemeTokens(themeId))) {
        expect(variables[`--geul-${name}`]).toBe(value);
      }
      expect(theme[base]).toBe(semanticThemes[base]);
    }
    expect(theme.defaultRadius).toBe(0);
    expect(theme.breakpoints).toBe(primitiveTokens.breakpoints);
    expect(theme.fontWeights).toBe(primitiveTokens.fontWeight);
    expect(theme.respectReducedMotion).toBe(true);
  });
});
