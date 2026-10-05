import { SocialIconGlyph, type SocialIconGlyphProps } from './SocialIconGlyph';
import { SOCIAL_ICON_DEFINITIONS, type SocialPlatform } from './platforms';

export type { SocialPlatform };

export interface SocialIconBrandColors {
  light: string;
  dark?: string;
}

const DARK_BRAND_COLOR_OVERRIDES: Partial<Record<SocialPlatform, string>> = {
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

export function getSocialIconLabel(platform: SocialPlatform): string {
  return SOCIAL_ICON_DEFINITIONS[platform].label;
}

export function getSocialIconBrandColors(platform: SocialPlatform): SocialIconBrandColors {
  const light = `#${SOCIAL_ICON_DEFINITIONS[platform].icon.hex}`;
  const dark = DARK_BRAND_COLOR_OVERRIDES[platform];

  return dark ? { light, dark } : { light };
}

export type { SocialIconColorMode } from './SocialIconGlyph';

export interface SocialIconProps extends Omit<SocialIconGlyphProps, 'path' | 'light' | 'dark'> {}

/** Compatibility wrapper for consumers that select icons by platform on the client. */
export function SocialIcon({ platform, ...props }: SocialIconProps) {
  return (
    <SocialIconGlyph
      {...props}
      platform={platform}
      path={SOCIAL_ICON_DEFINITIONS[platform].icon.path}
      {...getSocialIconBrandColors(platform)}
    />
  );
}
