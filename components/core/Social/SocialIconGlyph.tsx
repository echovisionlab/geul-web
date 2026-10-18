import type { CSSProperties } from 'react';
import { primitiveTokens } from '../design-tokens';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import type { SocialPlatform } from './platforms';
import classes from './SocialIcon.module.css';

export type SocialIconColorMode = 'currentColor' | 'brand' | 'hoverBrand';
export type SocialIconSize = keyof typeof primitiveTokens.iconSize;

declare const preparedSocialIcon: unique symbol;

/**
 * Serializable platform glyph produced only by Core `prepareSocialIcon(platform)`.
 * Its brand colors come from the Core platform registry; consumers cannot supply CSS colors.
 */
export interface PreparedSocialIcon {
  readonly platform: SocialPlatform;
  readonly path: string;
  readonly light: string;
  readonly dark?: string;
  readonly [preparedSocialIcon]: true;
}

export interface SocialIconGlyphProps extends Omit<PresentationProps, 'children'> {
  children?: never;
  width?: never;
  height?: never;
  fill?: never;
  stroke?: never;
  strokeWidth?: never;
  /** Prepared on the server (or wherever the platform catalog is loaded) by `prepareSocialIcon`. */
  icon: PreparedSocialIcon;
  size?: SocialIconSize;
  colorMode?: SocialIconColorMode;
  label?: string;
}

type SocialIconStyle = CSSProperties & {
  '--_social-brand-light': string;
  '--_social-brand-dark': string;
};

/** Render a prepared social SVG without loading a platform icon catalog. */
export function SocialIconGlyph({
  icon: { platform, path, light, dark },
  size = 'lg',
  colorMode = 'currentColor',
  label,
  ...props
}: SocialIconGlyphProps) {
  const dimension = primitiveTokens.iconSize[size];
  if (!Object.hasOwn(primitiveTokens.iconSize, size)) {
    throw new RangeError('Social icons require a registered icon size.');
  }
  const iconStyle: SocialIconStyle = {
    '--_social-brand-light': light,
    '--_social-brand-dark': dark ?? light,
  };

  return (
    <svg
      {...presentationAttributes(props)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      width={dimension}
      height={dimension}
      fill="currentColor"
      className={classes.icon}
      style={iconStyle}
      data-social-platform={platform}
      data-color-mode={colorMode}
    >
      <path d={path} />
    </svg>
  );
}
