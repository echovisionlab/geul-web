'use client';

import { useComputedColorScheme } from '@/lib/providers/DesignSystemProvider';

import type { CSSProperties } from 'react';

import { SiteLogoView } from '@/features/site/ui/SiteLogo';
import type { SiteLogoSize } from '@/features/site/ui/SiteLogo/SiteLogoView';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { toCdnUrl } from '@/lib/utils/file-url';
import { selectThemeAssetUrl } from '@/lib/utils/theme-asset';

export interface SiteLogoProps {
  size?: SiteLogoSize;
  height?: number | 'intrinsic';
  style?: CSSProperties;
}

export function SiteLogo({ size = 'md', height, style }: SiteLogoProps) {
  const { settings } = useSiteSettings();
  const colorScheme = useComputedColorScheme();
  const logoUrl = selectThemeAssetUrl(colorScheme, {
    lightUrl: settings.logo_light_url,
    darkUrl: settings.logo_dark_url,
    fallbackUrl: settings.logo_url,
  });

  return (
    <SiteLogoView
      src={logoUrl ? toCdnUrl(logoUrl) : null}
      alt={settings.site_title || 'Site logo'}
      size={size}
      fallbackText={settings.site_title || null}
      height={height}
      style={style}
    />
  );
}
