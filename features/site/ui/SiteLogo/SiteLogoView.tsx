'use client';

import { useState, type CSSProperties } from 'react';
import { Text, type TextSize } from '@/components/core/Typography';
import { primitiveTokens } from '@/components/core/design-tokens';

export type SiteLogoSize = Exclude<TextSize, 'display'>;

export interface SiteLogoViewProps {
  src: string | null;
  alt: string;
  /** Named typography role for the wordmark and the default image height. */
  size?: SiteLogoSize;
  /** Explicit authored image geometry remains supported. */
  height?: number;
  fallbackText?: string | null;
  style?: CSSProperties;
}

export function SiteLogoView({ src, alt, size = 'md', height, fallbackText, style }: SiteLogoViewProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src?.trim() || failedSrc === src) {
    const text = (fallbackText === undefined ? alt : fallbackText)?.trim() || 'LOGO';
    return (
      <Text as="span" size={size} weight="medium" nowrap>
        {text}
      </Text>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailedSrc(src)}
      style={{
        height: height ?? primitiveTokens.fontSize[size],
        display: 'inline-flex',
        width: 'auto',
        objectFit: 'contain',
        border: 0,
        ...style,
      }}
    />
  );
}
