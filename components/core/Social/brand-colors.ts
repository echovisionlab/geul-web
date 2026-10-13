import type { SocialPlatform } from './platforms';

// Catalog-free brand color data: importing this module never loads the simple-icons catalog.

/** Fixed provider identities, independent of Geul UI themes and social icon variants. */
export const mapProviderBrandColors = {
  google: { blue: '#4285F4', green: '#34A853', yellow: '#FBBC05', red: '#EA4335' },
  naver: { green: '#03C75A' },
} as const;

/** Dark-theme replacements for brand marks that are unreadable on dark surfaces. */
export const SOCIAL_ICON_DARK_BRAND_COLOR_OVERRIDES: Partial<Record<SocialPlatform, string>> = {
  twitter: '#ffffff',
  tiktok: '#ffffff',
  threads: '#ffffff',
  medium: '#ffffff',
  patreon: '#ffffff',
  github: '#f0f6fc',
  discogs: '#ffffff',
  tidal: '#ffffff',
  letterboxd: '#ffffff',
  mixcloud: '#ffffff',
};
