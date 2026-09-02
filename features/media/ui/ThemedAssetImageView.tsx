'use client';

import type { CSSProperties } from 'react';
import { Box } from '@mantine/core';

export interface ThemedAssetImageViewProps {
  src: string | null;
  alt: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}

export function ThemedAssetImageView({ src, alt, width, height, className, style }: ThemedAssetImageViewProps) {
  if (!src) {
    return null;
  }

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={{
        display: 'block',
        objectFit: 'contain',
        border: 0,
        ...style,
      }}
    />
  );
}
