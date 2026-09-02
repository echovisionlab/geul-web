'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ResolvedThemeConfig } from '@/lib/types/map-theme/model';
import type { MapViewTheme } from '@/lib/types/map/model';
import { buildResolvedThemeConfig, buildResolvedThemeConfigFromEmbeddedTheme } from '@/lib/utils/map-theme';

interface UseResolvedMapThemeConfigOptions {
  theme: MapViewTheme | null | undefined;
  scheme: 'light' | 'dark';
}

export function useResolvedMapThemeConfig({ theme, scheme }: UseResolvedMapThemeConfigOptions): {
  config: ResolvedThemeConfig | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const shouldResolveDefaultTheme = !theme;

  const defaultThemeQuery = useQuery({
    queryKey: ['mapTheme', 'resolve-default', scheme],
    queryFn: async () => {
      const { resolvePublicMapThemeAction } = await import('@/lib/actions/map-theme');
      return resolvePublicMapThemeAction(undefined, scheme);
    },
    enabled: shouldResolveDefaultTheme,
    staleTime: 60_000,
  });

  const config = useMemo(() => {
    if (theme) {
      return buildResolvedThemeConfigFromEmbeddedTheme(theme, scheme);
    }

    if (!defaultThemeQuery.data) {
      return undefined;
    }

    const { id: _id, scheme: _scheme, ...variant } = defaultThemeQuery.data.variant;
    return buildResolvedThemeConfig({
      settings: defaultThemeQuery.data.settings,
      variant,
      scheme,
    });
  }, [defaultThemeQuery.data, scheme, theme]);

  return {
    config,
    isLoading: shouldResolveDefaultTheme && defaultThemeQuery.isLoading,
    isError: shouldResolveDefaultTheme && defaultThemeQuery.isError,
  };
}
