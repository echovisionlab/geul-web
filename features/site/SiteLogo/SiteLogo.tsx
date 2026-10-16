'use client';

import type { CSSProperties } from 'react';

import { SiteLogoView } from '@/features/site/ui/SiteLogo';
import type { SiteLogoSize } from '@/features/site/ui/SiteLogo/SiteLogoView';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { toCdnUrl } from '@/lib/utils/file-url';

export interface SiteLogoProps {
  size?: SiteLogoSize;
  height?: number | 'intrinsic';
  style?: CSSProperties;
}

export function SiteLogo({ size = 'md', height, style }: SiteLogoProps) {
  const { settings } = useSiteSettings();
  const lightUrl = settings.logo_light_url ?? settings.logo_url ?? null;
  const darkUrl = settings.logo_dark_url ?? null;

  return (
    <SiteLogoView
      src={lightUrl ? toCdnUrl(lightUrl) : null}
      darkSrc={darkUrl ? toCdnUrl(darkUrl) : null}
      alt={settings.site_title || 'Site logo'}
      size={size}
      fallbackText={settings.site_title || null}
      height={height}
      style={style}
    />
  );
}
