import type { CSSProperties } from 'react';
import classes from './ExternalVideoView.module.css';

export type ExternalVideoPlayerAspectRatio = '16:9' | '4:3' | '1:1' | '9:16';

const ratios: Record<ExternalVideoPlayerAspectRatio, string> = {
  '16:9': '16 / 9',
  '4:3': '4 / 3',
  '1:1': '1',
  '9:16': '9 / 16',
};

export interface ExternalVideoPlayerViewProps {
  embedUrl: string;
  originalUrl: string;
  provider: 'youtube' | 'vimeo';
  title: string;
  caption?: string;
  aspectRatio: ExternalVideoPlayerAspectRatio;
  className?: string;
  style?: CSSProperties;
}

export function ExternalVideoPlayerView({
  embedUrl,
  originalUrl,
  provider,
  title,
  caption,
  aspectRatio,
  className,
  style,
}: ExternalVideoPlayerViewProps) {
  const playerFrameStyle: CSSProperties =
    aspectRatio === '9:16' ? { width: 'min(100%, 22.5rem)', marginInline: 'auto' } : { width: '100%' };

  return (
    <figure className={className} style={style} data-external-video={provider}>
      <div className={classes.playerFrame} data-external-video-player-frame style={playerFrameStyle}>
        <iframe
          src={embedUrl}
          title={title}
          loading="lazy"
          allow="fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ display: 'block', width: '100%', aspectRatio: ratios[aspectRatio], border: 0 }}
        />
      </div>
      {caption ? <figcaption>{caption}</figcaption> : null}
      <a className={classes.fallbackLink} href={originalUrl} data-external-video-fallback>
        {title}
        <span className={classes.printUrl} data-external-video-print-url aria-hidden="true">
          {' '}
          ({originalUrl})
        </span>
      </a>
    </figure>
  );
}
