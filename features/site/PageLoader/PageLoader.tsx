'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MantineColor } from '@mantine/core';
import { PageLoaderView, type PageLoaderViewSize } from '@/components/core/LoadingSurface';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { toCdnUrl } from '@/lib/utils/file-url';

function shouldBypassNextImageOptimization(src: string): boolean {
  try {
    const pathname = new URL(src).pathname.toLowerCase();
    return pathname.endsWith('.gif') || pathname.endsWith('.svg');
  } catch {
    return src.toLowerCase().endsWith('.gif') || src.toLowerCase().endsWith('.svg');
  }
}

function pickRandomLoaderUrl(urls: string[]): string | null {
  if (urls.length === 0) {
    return null;
  }
  return urls[Math.floor(Math.random() * urls.length)] ?? urls[0] ?? null;
}

function pickInitialLoaderUrl(urls: string[]): string | null {
  return urls[0] ?? null;
}

export interface PageLoaderProps {
  /** Height of the loader container. Defaults to '100%' for full parent height. */
  height?: string | number;
  /** Minimum height safeguard for page-sized loaders. Defaults to 200. */
  minHeight?: string | number;
  /** Loader size. Defaults to 'md'. */
  size?: PageLoaderViewSize;
  /** Loader color. Applies only to the fallback Mantine Loader. */
  color?: MantineColor;
  /** Optional message to display below the loader. */
  message?: string;
}

export function PageLoader({ height = '100%', minHeight = 200, size = 'md', color, message }: PageLoaderProps) {
  const t = useTranslations('common.states');
  const { settings } = useSiteSettings();
  const configuredLoaderUrls = settings.loader_urls ?? [];
  const loaderUrlsKey = configuredLoaderUrls.join('\u0000');
  const [selectedLoader, setSelectedLoader] = useState(() => pickInitialLoaderUrl(configuredLoaderUrls));

  useEffect(() => {
    const urls = loaderUrlsKey ? loaderUrlsKey.split('\u0000') : [];
    setSelectedLoader(pickRandomLoaderUrl(urls));
  }, [loaderUrlsKey]);

  const imageSrc = selectedLoader ? toCdnUrl(selectedLoader) : null;

  return (
    <PageLoaderView
      height={height}
      minHeight={minHeight}
      size={size}
      color={color}
      message={message}
      imageSrc={imageSrc}
      imageAlt={t('loading')}
      imageUnoptimized={imageSrc ? shouldBypassNextImageOptimization(imageSrc) : false}
    />
  );
}
