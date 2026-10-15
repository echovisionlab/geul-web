import { primitiveTokens, semanticThemes, type SemanticToken, type ThemeMode } from '@/components/core/design-tokens';

type ThemePreset = {
  readonly label: string;
  readonly base: ThemeMode;
  readonly overrides: Readonly<Partial<Record<SemanticToken, string>>>;
};

const colors = primitiveTokens.colors;

/** A preset changes existing roles; it does not add another set of component tokens. */
export const themePresets = {
  light: { label: 'Light', base: 'light', overrides: {} },
  dark: { label: 'Dark', base: 'dark', overrides: {} },
  'ocean-light': {
    label: 'Ocean light',
    base: 'light',
    overrides: {
      background: colors.blue[50],
      surface: colors.white,
      'surface-muted': colors.neutral[100],
      'surface-hover': colors.blue[100],
      'surface-active': colors.blue[200],
      'text-muted': colors.blue[700],
      'border-default': colors.blue[300],
      'action-ink': colors.blue[900],
      'action-ink-muted': colors.blue[700],
      'action-primary': colors.blue[700],
      'action-primary-hover': colors.blue[800],
      'action-primary-pressed': colors.blue[900],
      focus: colors.blue[900],
      'status-warning': colors.yellow[900],
    },
  },
  'ocean-dark': {
    label: 'Ocean dark',
    base: 'dark',
    overrides: {
      surface: colors.blue[900],
      'surface-muted': colors.graphite[800],
      'surface-active': colors.blue[800],
      'action-ink': colors.blue[100],
      'action-ink-muted': colors.blue[200],
      'action-primary': colors.blue[300],
      'action-primary-hover': colors.blue[200],
      'action-primary-pressed': colors.blue[100],
      focus: colors.blue[100],
    },
  },
} as const satisfies Record<string, ThemePreset>;

export type ThemeId = keyof typeof themePresets;
export interface ThemeDefinition extends ThemePreset {
  readonly id: ThemeId;
}

export const themeIds = Object.freeze(Object.keys(themePresets) as ThemeId[]);
export const themeDefinitions: readonly ThemeDefinition[] = Object.freeze(
  themeIds.map((id) =>
    Object.freeze({ id, ...themePresets[id], overrides: Object.freeze({ ...themePresets[id].overrides }) }),
  ),
);

export function normalizeThemeId(value: unknown, fallback: ThemeId = 'light'): ThemeId {
  return typeof value === 'string' && Object.hasOwn(themePresets, value) ? (value as ThemeId) : fallback;
}

/** Unknown URL/global values safely use the standard light theme. */
export function getThemeDefinition(value: unknown): ThemeDefinition {
  const id = normalizeThemeId(value);
  return themeDefinitions.find((definition) => definition.id === id)!;
}

export function getThemeTokens(value: unknown): Readonly<Record<SemanticToken, string>> {
  const definition = getThemeDefinition(value);
  return { ...semanticThemes[definition.base], ...definition.overrides };
}
