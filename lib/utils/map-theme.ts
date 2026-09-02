import type { MapTheme, ResolvedThemeConfig, ThemeSettings, ThemeVariant } from '@/lib/types/map-theme/model';
import type { MapLabelVisibilityMode, MapViewTheme } from '@/lib/types/map/model';

type ThemeVariantInput = Omit<ThemeVariant, 'id' | 'scheme'>;

interface BuildResolvedThemeConfigInput {
  settings: ThemeSettings;
  variant: ThemeVariantInput;
  scheme: 'light' | 'dark';
}

export function buildResolvedThemeConfig({ settings, variant }: BuildResolvedThemeConfigInput): ResolvedThemeConfig {
  return {
    ...variant,
    ...settings,
  };
}

export function buildResolvedThemeConfigFromEmbeddedTheme(
  theme: MapViewTheme | null | undefined,
  scheme: 'light' | 'dark',
): ResolvedThemeConfig | undefined {
  if (!theme) {
    return undefined;
  }

  return buildResolvedThemeConfig({
    settings: theme.settings,
    variant: scheme === 'dark' ? theme.darkVariant : theme.lightVariant,
    scheme,
  });
}

export function mapThemeToViewTheme(theme: MapTheme): MapViewTheme {
  const { id: _lightId, scheme: _lightScheme, ...lightVariant } = theme.lightVariant;
  const { id: _darkId, scheme: _darkScheme, ...darkVariant } = theme.darkVariant;

  return {
    id: theme.id,
    settings: theme.settings,
    lightVariant,
    darkVariant,
  };
}

export function resolveMapLabelVisibility(mode: MapLabelVisibilityMode | undefined, themeDefault: boolean): boolean {
  switch (mode) {
    case 'show':
      return true;
    case 'hide':
      return false;
    default:
      return themeDefault;
  }
}
