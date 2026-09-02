'use client';

import type { CSSProperties } from 'react';
import { useComputedColorScheme } from '@mantine/core';
import { SiteLogoView } from '@/features/site/ui/SiteLogo';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { toCdnUrl } from '@/lib/utils/file-url';
import { selectThemeAssetUrl } from '@/lib/utils/theme-asset';

export interface SiteLogoProps {
  height?: number;
  style?: CSSProperties;
}

export function SiteLogo({ height = 16, style }: SiteLogoProps) {
  const { settings } = useSiteSettings();
  const colorScheme = useComputedColorScheme('light');
  const logoUrl = selectThemeAssetUrl(colorScheme, {
    lightUrl: settings.logo_light_url,
    darkUrl: settings.logo_dark_url,
    fallbackUrl: settings.logo_url,
  });

  return (
    <SiteLogoView
      src={logoUrl ? toCdnUrl(logoUrl) : null}
      alt={settings.site_title || 'Site logo'}
      height={height}
      style={style}
    />
  );
}
