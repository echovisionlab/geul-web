'use client';

import Image from 'next/image';
import { Center, Loader, Stack, Text, type MantineColor } from '@mantine/core';

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
  color,
  message,
  imageSrc,
  imageAlt,
  imageUnoptimized = false,
}: PageLoaderViewProps) {
  return (
    <Center
      style={{
        height,
        minHeight,
        position: 'absolute',
        inset: 0,
      }}
    >
      <Stack align="center" gap="sm">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={IMAGE_SIZE_MAP[size]}
            height={IMAGE_SIZE_MAP[size]}
            preload
            unoptimized={imageUnoptimized}
          />
        ) : (
          <Loader
            size={size}
            color={color}
            vars={!color ? () => ({ root: { '--loader-color': 'var(--mantine-color-text)' } }) : undefined}
          />
        )}
        {message ? (
          <Text size="sm" c="dimmed">
            {message}
          </Text>
        ) : null}
      </Stack>
    </Center>
  );
}
