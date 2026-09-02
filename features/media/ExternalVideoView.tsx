import type { CSSProperties } from 'react';
import { normalizeRichTextHref } from '@echovisionlab/geul-common/editor/link-normalization';
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
  const video = resolveExternalVideo(url);
  if (!video) {
    const normalizedHref = normalizeRichTextHref(url);
    if (normalizedHref) {
      return <a href={normalizedHref}>{title}</a>;
    }
    return <span>{title}</span>;
  }

  return (
    <ExternalVideoPlayerView
      embedUrl={video.embedUrl}
      originalUrl={url}
      provider={video.provider}
      title={title}
      caption={caption}
      aspectRatio={aspectRatio === 'auto' ? video.aspectRatio : aspectRatio}
      className={className}
      style={style}
    />
  );
}
