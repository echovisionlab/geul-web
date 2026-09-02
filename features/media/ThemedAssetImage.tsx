'use client';

import type { CSSProperties } from 'react';
import { useComputedColorScheme } from '@mantine/core';
import { toCdnUrl } from '@/lib/utils/file-url';
import { selectThemeAssetUrl } from '@/lib/utils/theme-asset';
import { ThemedAssetImageView } from './ui/ThemedAssetImageView';

export interface ThemedAssetImageProps {
  lightUrl?: string | null;
  darkUrl?: string | null;
  fallbackUrl?: string | null;
  alt: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}

export function ThemedAssetImage({
  lightUrl,
  darkUrl,
  fallbackUrl,
  alt,
  width,
  height,
  className,
  style,
}: ThemedAssetImageProps) {
  const colorScheme = useComputedColorScheme('light');
  const url = selectThemeAssetUrl(colorScheme, { lightUrl, darkUrl, fallbackUrl });

  return (
    <ThemedAssetImageView
      src={url ? toCdnUrl(url) : null}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
    />
  );
}
