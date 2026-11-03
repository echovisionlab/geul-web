'use client';
import { Text } from '../Typography';
import type { ClosedVisualProps } from '../visual-contract';

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
export type PageLoaderViewContrast = 'standard' | 'inverse';
/**
 * Core-owned region height. `container` follows a parent that already reserves height (map, table,
 * media frame); the others reserve a named minimum: compact panels, sections, tall workspaces and the viewport.
 */
export type PageLoaderViewExtent = 'container' | 'compact' | 'section' | 'tall' | 'viewport';

export interface PageLoaderViewProps extends ClosedVisualProps {
  /** Standard text on theme surfaces, or full-strength inverse text on a dark scrim. */
  contrast?: PageLoaderViewContrast;
  /** Named region height. Defaults to `section`. */
  extent?: PageLoaderViewExtent;
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
  extent = 'section',
  placement = 'fill',
  contrast = 'standard',
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
  if (contrast !== 'standard' && contrast !== 'inverse') {
    throw new RangeError('PageLoaderView contrast must be standard or inverse');
  }
  return (
    <div
      className={classes.root}
      data-core-page-loader
      data-placement={placement}
      data-contrast={contrast}
      data-extent={extent}
      role="status"
      aria-label={imageAlt}
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
        <Text size="xs" tone="inherit" align="center">
          {message}
        </Text>
      </LayoutStack>
    </div>
  );
}
