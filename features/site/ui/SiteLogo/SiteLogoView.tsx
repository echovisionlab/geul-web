'use client';

import { useState, type CSSProperties } from 'react';
import { Text, type TextSize } from '@/components/core/Typography';
import { primitiveTokens } from '@echovisionlab/design-system/tokens';
import styles from './SiteLogoView.module.css';

export type SiteLogoSize = Exclude<TextSize, 'display'>;

/** Never exceed a header bar, whatever size the uploaded file declares. */
const INTRINSIC_MAX_HEIGHT = 'var(--_site-header-brand-max-height, var(--geul-chrome-header-height-sm))';

/** A file's own size, from `'intrinsic'` or `{ min }`. */
export type SiteLogoHeight = number | 'intrinsic' | { min: number };

export interface SiteLogoViewProps {
  /** Logo for light surfaces; also used on dark surfaces when `darkSrc` is absent. */
  src: string | null;
  /** Logo for dark surfaces. Switched by the document theme before first paint. */
  darkSrc?: string | null;
  alt: string;
  /** Named typography role for the wordmark and the default image height. */
  size?: SiteLogoSize;
  /**
   * Explicit authored image geometry remains supported. `'intrinsic'` and `{ min }` render
   * the uploaded image at its own size, so the uploaded file decides how large it is, up to
   * the site header's brand height (or the header height outside the header). An SVG with
   * only a viewBox has no size of its own and would collapse in a content-sized slot, so it
   * gets `min` (or the `size` icon height for `'intrinsic'`).
   */
  height?: SiteLogoHeight;
  fallbackText?: string | null;
  style?: CSSProperties;
}

export function SiteLogoView({ src, darkSrc, alt, size = 'md', height, fallbackText, style }: SiteLogoViewProps) {
  const [failedSrcs, setFailedSrcs] = useState<readonly string[]>([]);
  const usable = (url: string | null | undefined) => (url?.trim() && !failedSrcs.includes(url) ? url : null);
  const light = usable(src) ?? usable(darkSrc);
  const dark = usable(darkSrc);
  if (!light) {
    const text = (fallbackText === undefined ? alt : fallbackText)?.trim() || 'LOGO';
    return (
      <Text as="span" size={size} weight="medium" nowrap>
        {text}
      </Text>
    );
  }

  const intrinsic = height === 'intrinsic' || typeof height === 'object';
  const imageStyle: CSSProperties = intrinsic
    ? {
        height: 'auto',
        minHeight: typeof height === 'object' ? height.min : primitiveTokens.iconSize[size],
        maxHeight: INTRINSIC_MAX_HEIGHT,
        maxWidth: '100%',
        ...style,
      }
    : { height: height ?? primitiveTokens.iconSize[size], ...style };
  const markFailed = (url: string) => setFailedSrcs((current) => (current.includes(url) ? current : [...current, url]));
  if (!dark || dark === light) {
    return <img src={light} alt={alt} onError={() => markFailed(light)} className={styles.image} style={imageStyle} />;
  }

  return (
    <>
      <img
        src={light}
        alt={alt}
        data-logo-scheme="light"
        onError={() => markFailed(light)}
        className={`${styles.image} ${styles.themed}`}
        style={imageStyle}
      />
      <img
        src={dark}
        alt={alt}
        data-logo-scheme="dark"
        onError={() => markFailed(dark)}
        className={`${styles.image} ${styles.themed}`}
        style={imageStyle}
      />
    </>
  );
}
