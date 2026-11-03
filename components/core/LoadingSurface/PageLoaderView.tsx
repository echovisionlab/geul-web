'use client';
import { Text } from '../Typography';

import Image from 'next/image';
import { useState } from 'react';
import { LayoutStack } from '../Layout';

import classes from './PageLoaderView.module.css';

const IMAGE_SIZE_MAP: Record<PageLoaderViewSize, number> = {
  xs: 48,
  sm: 64,
  md: 80,
  lg: 100,
  xl: 120,
};

export type PageLoaderViewSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type PageLoaderViewPlacement = 'fill' | 'flow';

export interface PageLoaderViewProps {
  /** Defaults to '100%' in fill placement and 'auto' in flow placement. */
  height?: string | number;
  /** Minimum height safeguard for page-sized loaders. Defaults to 200. */
  minHeight?: string | number;
  /** Fill a positioned parent, or reserve height in normal document flow. Defaults to fill. */
  placement?: PageLoaderViewPlacement;
  size?: PageLoaderViewSize;
  /** Required nonblank visible text, resolved by the owning controller. */
  message: string;
  imageSrc?: string | null;
  /** Accessible name for the image and status; independent of visible message text. */
  imageAlt: string;
  imageUnoptimized?: boolean;
}

export function PageLoaderView({
  height,
  minHeight = 200,
  placement = 'fill',
  size = 'md',
  message,
  imageSrc,
  imageAlt,
  imageUnoptimized = false,
}: PageLoaderViewProps) {
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
  if (!message.trim()) {
    throw new Error('PageLoaderView requires a nonblank visible message');
  }
  return (
    <div
      className={classes.root}
      data-core-page-loader
      data-placement={placement}
      role="status"
      aria-label={imageAlt}
      style={{
        height: height ?? (placement === 'flow' ? 'auto' : '100%'),
        minHeight,
      }}
    >
      <LayoutStack align="center" gap="sm">
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
        <Text size="xs" tone="muted" align="center">
          {message}
        </Text>
      </LayoutStack>
    </div>
  );
}
