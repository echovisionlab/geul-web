'use client';

import type { CSSProperties } from 'react';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { resolveSiteVariableHref, siteVariableContext } from '@/lib/site-variables';
import { resolveExternalVideo, type ExternalVideoAspectRatio } from '@/lib/media/external-video';
import { ExternalVideoPlayerView } from './ui/ExternalVideoView';

export interface ExternalVideoViewProps {
  url: string;
  title: string;
  caption?: string;
  aspectRatio?: ExternalVideoAspectRatio | 'auto';
  className?: string;
  style?: CSSProperties;
}

export function ExternalVideoView({
  url,
  title,
  caption,
  aspectRatio = 'auto',
  className,
  style,
}: ExternalVideoViewProps) {
  const { settings } = useSiteSettings();
  const href = resolveSiteVariableHref(url, siteVariableContext(settings));
  if (!href) {
    return <span>{title}</span>;
  }
  const video = resolveExternalVideo(href);
  if (!video) {
    return <a href={href}>{title}</a>;
  }

  return (
    <ExternalVideoPlayerView
      embedUrl={video.embedUrl}
      originalUrl={href}
      provider={video.provider}
      title={title}
      caption={caption}
      aspectRatio={aspectRatio === 'auto' ? video.aspectRatio : aspectRatio}
      className={className}
      style={style}
    />
  );
}
