'use client';
import type { ReactNode } from 'react';
import { IconPlayerPlayFilled, IconPlayerPauseFilled, IconVolume, IconVolumeOff } from '@tabler/icons-react';
import type { ClosedVisualProps } from '../visual-contract';
import { IconButton } from '../IconButton';
import { Text } from '../Typography';
import { NativeRange } from '../Input/NativeRange';
import surface from '../Section/Surface.module.css';
import classes from './MediaControls.module.css';
import { formatMediaClock } from './media-clock';

export interface MediaTransportLabels {
  play: string;
  pause: string;
  mute: string;
  unmute: string;
  volume: string;
}
export interface MediaTransportProps extends ClosedVisualProps {
  labels: MediaTransportLabels;
  playing: boolean;
  muted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  playbackDisabled?: boolean;
  volumeDisabled?: boolean;
  onPlay: () => void;
  onMute: () => void;
  onVolumeChange: (value: number) => void;
  actions?: ReactNode;
  playbackTitle?: string;
}
export { formatMediaClock };
export function MediaTransport({
  labels,
  playing,
  muted,
  volume,
  currentTime,
  duration,
  playbackDisabled,
  volumeDisabled,
  onPlay,
  onMute,
  onVolumeChange,
  actions,
  playbackTitle,
}: MediaTransportProps) {
  return (
    <div className={`${classes.transport} audio-player__footer`}>
      <div className={classes.controls}>
        <IconButton
          label={playing ? labels.pause : labels.play}
          size="chrome"
          disabled={playbackDisabled}
          onClick={onPlay}
          title={playbackTitle}
          data-audio-player-toggle="true"
        >
          {playing ? <IconPlayerPauseFilled /> : <IconPlayerPlayFilled />}
        </IconButton>
        <IconButton
          label={muted ? labels.unmute : labels.mute}
          size="chrome"
          disabled={volumeDisabled}
          onClick={onMute}
          data-audio-player-mute="true"
          data-muted={String(muted)}
        >
          {muted ? <IconVolumeOff /> : <IconVolume />}
        </IconButton>
        <div className={classes.volume}>
          <NativeRange
            purpose="audio-volume"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            label={labels.volume}
            disabled={volumeDisabled}
            onChange={onVolumeChange}
          />
        </div>
      </div>
      <div className={classes.clock}>
        <Text size="xs" weight="strong" data-audio-player-current-time="true">
          {formatMediaClock(currentTime)}
        </Text>
        <Text size="xs" tone="muted" aria-hidden>
          /
        </Text>
        <Text size="xs" tone="muted" data-audio-player-duration="true">
          {duration > 0 ? formatMediaClock(duration) : '--:--'}
        </Text>
      </div>
      <div className={`${classes.actions} audio-player__toolbar`}>{actions}</div>
    </div>
  );
}
export interface MediaAudioFrameProps extends ClosedVisualProps {
  children: ReactNode;
  playing: boolean;
  ready: boolean;
  role?: 'group';
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}
/** The React and hydrated native player consume the same SectionCard surface and media geometry. */
export function MediaAudioFrame({
  children,
  playing,
  ready,
  role,
  'aria-label': label,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
}: MediaAudioFrameProps) {
  return (
    <div
      className={`${classes.audio} ${surface.surface} audio-player`}
      data-border="all"
      data-appearance="surface"
      role={role ?? (label || labelledBy ? 'group' : undefined)}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      data-audio-player="true"
      data-audio-player-view="waveform"
      data-audio-player-playing={String(playing)}
      data-audio-player-ready={String(ready)}
    >
      <div className={classes.content}>{children}</div>
    </div>
  );
}
