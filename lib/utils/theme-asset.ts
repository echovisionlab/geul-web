export interface ThemeAssetUrls {
  lightUrl?: string | null;
  darkUrl?: string | null;
  fallbackUrl?: string | null;
}

export function selectThemeAssetUrl(colorScheme: 'light' | 'dark', urls: ThemeAssetUrls): string | null {
  const lightUrl = urls.lightUrl ?? urls.fallbackUrl ?? null;
  const darkUrl = urls.darkUrl ?? null;

  if (colorScheme === 'dark') {
    return darkUrl ?? lightUrl;
  }

  return lightUrl ?? darkUrl;
}
