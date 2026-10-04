'use client';

import { useTranslations } from 'next-intl';
import type { MantineColor } from '@mantine/core';
import { PageLoaderView, type PageLoaderViewSize } from '@/components/core/LoadingSurface';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { resolvePageLoaderImage } from './loader-image';

export interface PageLoaderProps {
  /** Height of the loader container. Defaults to '100%' for full parent height. */
  height?: string | number;
  /** Minimum height safeguard for page-sized loaders. Defaults to 200. */
  minHeight?: string | number;
  /** Loader size. Defaults to 'md'. */
  size?: PageLoaderViewSize;
  /** Retained for caller compatibility. Configured loading images keep their colors. */
  color?: MantineColor;
  /** Optional message to display below the loader. */
  message?: string;
}

export function PageLoader({ height = '100%', minHeight = 200, size = 'md', color, message }: PageLoaderProps) {
  const t = useTranslations('common.states');
  const { settings } = useSiteSettings();
  const image = resolvePageLoaderImage(settings.loader_urls ?? []);
  const loadingLabel = t('loading');

  return (
    <PageLoaderView
      height={height}
      minHeight={minHeight}
      size={size}
      color={color}
      message={message?.trim() === loadingLabel.trim() ? undefined : message}
      imageSrc={image.src}
      imageAlt={loadingLabel}
      imageUnoptimized={image.unoptimized}
    />
  );
}
