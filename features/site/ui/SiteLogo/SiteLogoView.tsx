import type { CSSProperties } from 'react';
import { Box } from '@mantine/core';

export interface SiteLogoViewProps {
  src: string | null;
  alt: string;
  height?: number;
  style?: CSSProperties;
}

export function SiteLogoView({ src, alt, height = 16, style }: SiteLogoViewProps) {
  if (!src) {
    return null;
  }

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      style={{
        height,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 'auto',
        objectFit: 'contain',
        border: 0,
        ...style,
      }}
    />
  );
}
