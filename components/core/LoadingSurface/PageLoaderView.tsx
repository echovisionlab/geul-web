'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Center, Stack, Text, type MantineColor } from '@mantine/core';

const IMAGE_SIZE_MAP: Record<PageLoaderViewSize, number> = {
  xs: 48,
  sm: 64,
  md: 80,
  lg: 100,
  xl: 120,
};

export type PageLoaderViewSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface PageLoaderViewProps {
  /** Height of the loader container. Defaults to '100%' for full parent height. */
  height?: string | number;
  /** Minimum height safeguard for page-sized loaders. Defaults to 200. */
  minHeight?: string | number;
  size?: PageLoaderViewSize;
  /** Retained for caller compatibility. Configured images keep their colors. */
  color?: MantineColor;
  message?: string;
  imageSrc?: string | null;
  imageAlt: string;
  imageUnoptimized?: boolean;
}

export function PageLoaderView({
  height = '100%',
  minHeight = 200,
  size = 'md',
  message,
  imageSrc,
  imageAlt,
  imageUnoptimized = false,
}: PageLoaderViewProps) {
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
  return (
    <Center
      role="status"
      aria-label={imageAlt}
      aria-busy="true"
      style={{
        height,
        minHeight,
        position: 'absolute',
        inset: 0,
      }}
    >
      <Stack align="center" gap="sm">
        {imageSrc && imageSrc !== failedImageSrc ? (
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={IMAGE_SIZE_MAP[size]}
            height={IMAGE_SIZE_MAP[size]}
            unoptimized={imageUnoptimized}
            onError={() => setFailedImageSrc(imageSrc)}
          />
        ) : null}
        {message ? (
          <Text size="sm" c="dimmed">
            {message}
          </Text>
        ) : null}
      </Stack>
    </Center>
  );
}
