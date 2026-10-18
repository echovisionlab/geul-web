'use client';

import { useState, type CSSProperties } from 'react';
import { Text, type TextSize } from '@/components/core/Typography';
import { primitiveTokens } from '@/components/core/design-tokens';
import styles from './SiteLogoView.module.css';

export type SiteLogoSize = Exclude<TextSize, 'display'>;

export interface SiteLogoViewProps {
  /** Logo for light surfaces; also used on dark surfaces when `darkSrc` is absent. */
  src: string | null;
  /** Logo for dark surfaces. Switched by the document theme before first paint. */
  darkSrc?: string | null;
  alt: string;
  /** Named typography role for the wordmark and the default image height. */
  size?: SiteLogoSize;
  /**
   * Explicit authored image geometry remains supported. `'intrinsic'` renders the
   * uploaded image at its own size, so the uploaded file decides how large it is.
   */
  height?: number | 'intrinsic';
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

  const imageStyle: CSSProperties = {
    height: height === 'intrinsic' ? 'auto' : (height ?? primitiveTokens.iconSize[size]),
    maxWidth: height === 'intrinsic' ? '100%' : undefined,
    ...style,
  };
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
