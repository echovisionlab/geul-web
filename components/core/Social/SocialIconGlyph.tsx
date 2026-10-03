import type { CSSProperties, SVGProps } from 'react';
import type { SocialPlatform } from './platforms';
import classes from './SocialIcon.module.css';

export type SocialIconColorMode = 'currentColor' | 'brand' | 'hoverBrand';

export interface SocialIconGlyphProps extends Omit<
  SVGProps<SVGSVGElement>,
  'aria-hidden' | 'aria-label' | 'aria-labelledby' | 'children' | 'color' | 'focusable' | 'height' | 'role' | 'width'
> {
  platform: SocialPlatform;
  path: string;
  light: string;
  dark?: string;
  size?: number | string;
  colorMode?: SocialIconColorMode;
  label?: string;
}

type SocialIconStyle = CSSProperties & {
  '--social-icon-brand-light': string;
  '--social-icon-brand-dark': string;
};

/** Render a prepared social SVG without loading a platform icon catalog. */
export function SocialIconGlyph({
  platform,
  path,
  light,
  dark,
  size = 24,
  colorMode = 'currentColor',
  label,
  className,
  style,
  ...props
}: SocialIconGlyphProps) {
  const iconStyle: SocialIconStyle = {
    '--social-icon-brand-light': light,
    '--social-icon-brand-dark': dark ?? light,
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
      <path d={path} />
    </svg>
  );
}
