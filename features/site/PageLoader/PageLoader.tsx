'use client';

import { useTranslations } from 'next-intl';
import {
  PageLoaderView,
  type PageLoaderViewPlacement,
  type PageLoaderViewContrast,
  type PageLoaderViewExtent,
  type PageLoaderViewSize,
} from '@/components/core/LoadingSurface';
import type { ClosedVisualProps } from '@/components/core/visual-contract';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { resolvePageLoaderImage } from './loader-image';

export interface PageLoaderProps extends ClosedVisualProps {
  /** Standard theme text by default; inverse for loading on a dark scrim. */
  contrast?: PageLoaderViewContrast;
  /** Named region height owned by Core. Defaults to `section`. */
  extent?: PageLoaderViewExtent;
  /** Fill a positioned parent, or reserve a bounded section in document flow. Defaults to fill. */
  placement?: PageLoaderViewPlacement;
  /** Loader size. Defaults to 'md'. */
  size?: PageLoaderViewSize;
  /** Visible phase text; blank or omitted values use the localized loading message. */
  message?: string;
}

export function PageLoader({
  extent = 'section',
  placement = 'fill',
  contrast = 'standard',
  size = 'md',
  message,
}: PageLoaderProps) {
  const t = useTranslations('common.states');
  const { settings } = useSiteSettings();
  const image = resolvePageLoaderImage(settings.loader_urls ?? []);
  const loadingLabel = t('loading');

  return (
    <PageLoaderView
      extent={extent}
      placement={placement}
      contrast={contrast}
      size={size}
      message={message?.trim() || loadingLabel}
      imageSrc={image.src}
      imageAlt={loadingLabel}
      imageUnoptimized={image.unoptimized}
    />
  );
}
