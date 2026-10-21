'use client';

import { DISPLAY_SIZE_MAX, displaySizeInlineSize, parseAspectRatio } from '@/components/core/ResizeHandle/display-size';
import { useState, type CSSProperties } from 'react';
import { IconPlayerPlayFilled } from '@tabler/icons-react';
import { IconButton } from '@/components/core/IconButton';
import { LayoutInline } from '@/components/core/Layout';
import { MediaImage } from '@/components/core/MediaImage';
import { Text } from '@/components/core/Typography';
import classes from './ExternalVideoView.module.css';

export type ExternalVideoPlayerAspectRatio = '16:9' | '4:3' | '1:1' | '9:16';

const ratios: Record<ExternalVideoPlayerAspectRatio, string> = {
  '16:9': '16 / 9',
  '4:3': '4 / 3',
  '1:1': '1',
  '9:16': '9 / 16',
};

export interface ExternalVideoPlaybackLabels {
  /** Accessible name of the play control, e.g. "Play {title}". */
  play: string;
  /** Short notice that playing loads the provider's player. */
  notice: string;
}

export interface ExternalVideoPlayerViewProps {
  embedUrl: string;
  originalUrl: string;
  provider: 'youtube' | 'vimeo';
  title: string;
  caption?: string;
  aspectRatio: ExternalVideoPlayerAspectRatio;
  /**
   * With consent the provider player loads with the page. Without it the
   * stored thumbnail stands in until the visitor presses play, which loads
   * and starts that one player.
   */
  consented?: boolean;
  thumbnailUrl?: string | null;
  playbackLabels?: ExternalVideoPlaybackLabels;
  className?: string;
  style?: CSSProperties;
}

function playerSource(embedUrl: string, provider: 'youtube' | 'vimeo', autoplay: boolean): string {
  try {
    const url = new URL(embedUrl);
    if (autoplay) {
      url.searchParams.set('autoplay', '1');
    }
    // YouTube checks where its player is embedded; without an origin some videos refuse to play.
    if (provider === 'youtube' && typeof window !== 'undefined' && window.location.origin !== 'null') {
      url.searchParams.set('origin', window.location.origin);
    }
    return url.href;
  } catch {
    return embedUrl;
  }
}

export function ExternalVideoPlayerView({
  embedUrl,
  originalUrl,
  provider,
  title,
  caption,
  aspectRatio,
  consented = true,
  thumbnailUrl,
  playbackLabels,
  className,
  style,
}: ExternalVideoPlayerViewProps) {
  const [requested, setRequested] = useState(false);
  // The full display size rule: a portrait player fits the screen height, not the column.
  const playerFrameStyle: CSSProperties = {
    width: displaySizeInlineSize(DISPLAY_SIZE_MAX, parseAspectRatio(aspectRatio)),
    marginInline: 'auto',
  };
  const frameStyle: CSSProperties = { display: 'block', width: '100%', aspectRatio: ratios[aspectRatio], border: 0 };
  const showPlayer = consented || requested || !playbackLabels;

  return (
    <figure className={className} style={style} data-external-video={provider}>
      <div className={classes.playerFrame} data-external-video-player-frame style={playerFrameStyle}>
        {showPlayer ? (
          <iframe
            src={playerSource(embedUrl, provider, requested)}
            title={title}
            loading={requested ? 'eager' : 'lazy'}
            allow={requested ? 'autoplay; fullscreen; picture-in-picture' : 'fullscreen; picture-in-picture'}
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            style={frameStyle}
          />
        ) : (
          <div className={classes.facade} style={frameStyle} data-external-video-facade="">
            {thumbnailUrl ? <MediaImage src={thumbnailUrl} alt="" fit="cover" fill loading="lazy" /> : null}
            {/* A narrow player swaps in the compact control; display: none removes the other one. */}
            <span className={classes.facadeControl} data-facade-control="regular">
              <IconButton
                label={playbackLabels.play}
                shape="circle"
                size="lg"
                emphasis="strong"
                contrast="inverse"
                onClick={() => setRequested(true)}
              >
                <IconPlayerPlayFilled size={24} aria-hidden />
              </IconButton>
            </span>
            <span className={classes.facadeControl} data-facade-control="compact">
              <IconButton
                label={playbackLabels.play}
                shape="circle"
                size="sm"
                emphasis="strong"
                contrast="inverse"
                onClick={() => setRequested(true)}
              >
                <IconPlayerPlayFilled size={14} aria-hidden />
              </IconButton>
            </span>
            <span className={classes.facadeNotice}>
              <LayoutInline gap="xxs" wrap="wrap">
                <Text as="span" size="xs" weight="strong" contrast="image" lines={1}>
                  {title}
                </Text>
                <Text as="span" size="xs" contrast="image">
                  {playbackLabels.notice}
                </Text>
              </LayoutInline>
            </span>
          </div>
        )}
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
