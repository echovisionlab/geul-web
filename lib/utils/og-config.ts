import type { ContentOgImageConfig, HomeOgImageConfig, OgImageConfigs } from '@/lib/types/site-setting/config';

/**
 * Default OG Image Template Configuration
 * These values are used when no custom config is provided
 *
 * This is in a separate file from og-image.tsx to allow
 * client components to import it without pulling in sharp/satori
 */

// Homepage OG config: logo-centered, no title (minimal design)
export const DEFAULT_HOME_OG_CONFIG: HomeOgImageConfig = {
  darkBackground: '#1A1B1E',
  logo: {
    width: 200,
    height: 200,
  },
  siteTitle: {
    fontSize: 64,
    fontWeight: 700,
    color: '#ffffff',
  },
};

// Content OG config: title-centered with logo in bottom-right
export const DEFAULT_CONTENT_OG_CONFIG: ContentOgImageConfig = {
  darkBackground: '#1A1B1E',
  title: {
    maxLength: 80,
    fontSizeThreshold: 40,
    fontSizeLarge: 56,
    fontSizeSmall: 48,
    fontWeight: 700,
    color: '#ffffff',
    lineHeight: 1.3,
    padding: { top: 60, right: 80, bottom: 60, left: 80 },
  },
  logo: {
    width: 48,
    height: 48,
    position: { bottom: 32, right: 40 },
  },
  siteTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#ffffff',
    opacity: 0.9,
  },
};

// Combined default configs
export const DEFAULT_OG_CONFIGS: OgImageConfigs = {
  home: DEFAULT_HOME_OG_CONFIG,
  content: DEFAULT_CONTENT_OG_CONFIG,
};
