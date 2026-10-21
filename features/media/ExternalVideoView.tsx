'use client';

import type { CSSProperties } from 'react';
import { useOptionalCookieConsent } from '@/features/cookie-consent/useOptionalCookieConsent';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { resolveSiteVariableHref, siteVariableContext } from '@/lib/site-variables';
import { resolveExternalVideo, type ExternalVideoAspectRatio } from '@/lib/media/external-video';
import { ExternalVideoPlayerView, type ExternalVideoPlaybackLabels } from './ui/ExternalVideoView';

/** Localized play control and notice for a video whose player has not loaded yet. */
export type ExternalVideoPlaybackLabelFormatter = (input: {
  title: string;
  provider: string;
}) => ExternalVideoPlaybackLabels;

export interface ExternalVideoViewProps {
  url: string;
  title: string;
  caption?: string;
  aspectRatio?: ExternalVideoAspectRatio | 'auto';
  /** Stored thumbnail File delivery shown until consent or an explicit play. */
  thumbnailUrl?: string | null;
  /**
   * Public and editor surfaces always pass these, so the player waits for
   * consent or a play press. Without them the player loads directly.
   */
  playbackLabels?: ExternalVideoPlaybackLabelFormatter;
  className?: string;
  style?: CSSProperties;
}

const PROVIDER_NAMES = { youtube: 'YouTube', vimeo: 'Vimeo' } as const;

export function ExternalVideoView({
  url,
  title,
  caption,
  aspectRatio = 'auto',
  thumbnailUrl,
  playbackLabels,
  className,
  style,
}: ExternalVideoViewProps) {
  const { settings } = useSiteSettings();
  const consented = useOptionalCookieConsent();
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
      consented={consented}
      thumbnailUrl={thumbnailUrl}
      playbackLabels={playbackLabels?.({ title, provider: PROVIDER_NAMES[video.provider] })}
      className={className}
      style={style}
    />
  );
}
