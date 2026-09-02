import type { CSSProperties, SVGProps } from 'react';
import classes from './SocialIcon.module.css';
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

export type SocialIconColorMode = 'currentColor' | 'brand' | 'hoverBrand';

export interface SocialIconProps extends Omit<
  SVGProps<SVGSVGElement>,
  'aria-hidden' | 'aria-label' | 'aria-labelledby' | 'children' | 'color' | 'focusable' | 'height' | 'role' | 'width'
> {
  platform: SocialPlatform;
  size?: number | string;
  colorMode?: SocialIconColorMode;
  label?: string;
}

type SocialIconStyle = CSSProperties & {
  '--social-icon-brand-light': string;
  '--social-icon-brand-dark': string;
};

/** Pure platform icon primitive. URL parsing and link behavior belong to feature code. */
export function SocialIcon({
  platform,
  size = 24,
  colorMode = 'currentColor',
  label,
  className,
  style,
  ...props
}: SocialIconProps) {
  const icon = SOCIAL_ICON_DEFINITIONS[platform].icon;
  const brandColors = getSocialIconBrandColors(platform);
  const iconStyle: SocialIconStyle = {
    '--social-icon-brand-light': brandColors.light,
    '--social-icon-brand-dark': brandColors.dark ?? brandColors.light,
    ...style,
  };

  return (
    <svg
      {...props}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="currentColor"
      className={[classes.icon, className].filter(Boolean).join(' ')}
      style={iconStyle}
      data-social-platform={platform}
      data-color-mode={colorMode}
    >
      <path d={icon.path} />
    </svg>
  );
}
