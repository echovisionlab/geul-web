'use client';

import type { CSSProperties } from 'react';

import { SiteLogoView } from '@/features/site/ui/SiteLogo';
import type { SiteLogoHeight, SiteLogoSize } from '@/features/site/ui/SiteLogo/SiteLogoView';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { toCdnUrl } from '@/lib/utils/file-url';

export interface SiteLogoProps {
  /** full: symbol with wordmark (default); symbol: the mark alone, for compact spaces. */
  form?: 'full' | 'symbol';
  size?: SiteLogoSize;
  height?: SiteLogoHeight;
  style?: CSSProperties;
}

/** The site's light/dark logo pair. The manifest resolves fallbacks, so both are set when any logo is. */
export function SiteLogo({ form = 'full', size = 'md', height, style }: SiteLogoProps) {
  const { settings } = useSiteSettings();
  const lightUrl = form === 'symbol' ? settings.logo_symbol_light_url : settings.logo_full_light_url;
  const darkUrl = form === 'symbol' ? settings.logo_symbol_dark_url : settings.logo_full_dark_url;

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
