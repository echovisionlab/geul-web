import { describe, expect, it } from 'vitest';
import {
  createMapThemeInputSchema,
  DEFAULT_DARK_VARIANT,
  DEFAULT_LIGHT_VARIANT,
  DEFAULT_THEME_SETTINGS,
} from './schema';

const validInput = {
  name: '  Editorial  ',
  settings: DEFAULT_THEME_SETTINGS,
  lightVariant: DEFAULT_LIGHT_VARIANT,
  darkVariant: DEFAULT_DARK_VARIANT,
};

describe('createMapThemeInputSchema', () => {
  it('reuses the strict Common snapshot grammar and trims the name', () => {
    expect(createMapThemeInputSchema.parse(validInput).name).toBe('Editorial');
    expect(() => createMapThemeInputSchema.parse({ ...validInput, unknown: true })).toThrow();
    expect(() =>
      createMapThemeInputSchema.parse({
        ...validInput,
        lightVariant: { ...DEFAULT_LIGHT_VARIANT, unknown: true },
      }),
    ).toThrow();
  });

  it('rejects fractional integer settings and unsafe CSS colors before submit', () => {
    expect(() =>
      createMapThemeInputSchema.parse({
        ...validInput,
        settings: { ...DEFAULT_THEME_SETTINGS, calloutOffsetX: 1.5 },
      }),
    ).toThrow();
    expect(() =>
      createMapThemeInputSchema.parse({
        ...validInput,
        darkVariant: { ...DEFAULT_DARK_VARIANT, backgroundColor: 'var(--secret)' },
      }),
    ).toThrow();
    expect(() =>
      createMapThemeInputSchema.parse({
        ...validInput,
        darkVariant: { ...DEFAULT_DARK_VARIANT, backgroundColor: 'rgb(256, 0, 0)' },
      }),
    ).toThrow();
  });
});
