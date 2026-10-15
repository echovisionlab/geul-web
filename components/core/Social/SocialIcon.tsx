import { mapProviderBrandColors, SOCIAL_ICON_DARK_BRAND_COLOR_OVERRIDES } from './brand-colors';
import { SocialIconGlyph, type PreparedSocialIcon, type SocialIconGlyphProps } from './SocialIconGlyph';
import { SocialIdentityIcon, type SocialIdentityProvider } from './SocialIdentityIcon';
import { SOCIAL_ICON_DEFINITIONS, type SocialPlatform } from './platforms';

export type { SocialPlatform, SocialIdentityProvider };
export { mapProviderBrandColors };

/** Every platform key SocialIcon can draw: social-link platforms plus sign-in identities. */
export type SocialIconPlatform = SocialPlatform | SocialIdentityProvider;

export interface SocialIconBrandColors {
  light: string;
  dark?: string;
}

export function getSocialIconLabel(platform: SocialPlatform): string {
  return SOCIAL_ICON_DEFINITIONS[platform].label;
}

export function getSocialIconBrandColors(platform: SocialPlatform): SocialIconBrandColors {
  const light = `#${SOCIAL_ICON_DEFINITIONS[platform].icon.hex}`;
  const dark = SOCIAL_ICON_DARK_BRAND_COLOR_OVERRIDES[platform];

  return dark ? { light, dark } : { light };
}

export type { SocialIconColorMode, SocialIconSize, PreparedSocialIcon } from './SocialIconGlyph';

/** Prepares a serializable glyph where the catalog is loaded, for a catalog-free client renderer. */
export function prepareSocialIcon(platform: SocialPlatform): PreparedSocialIcon {
  return {
    platform,
    path: SOCIAL_ICON_DEFINITIONS[platform].icon.path,
    ...getSocialIconBrandColors(platform),
  } as PreparedSocialIcon;
}

export interface SocialIconProps extends Omit<SocialIconGlyphProps, 'icon'> {
  platform: SocialIconPlatform;
}

/** Selects a platform icon on the client; Core owns its geometry and brand colors. */
export function SocialIcon({ platform, ...props }: SocialIconProps) {
  if (platform === 'google') {
    return <SocialIdentityIcon {...props} platform="google" />;
  }
  return <SocialIconGlyph {...props} icon={prepareSocialIcon(platform)} />;
}
