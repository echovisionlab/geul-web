'use client';

import type { CSSProperties, ReactNode } from 'react';
import {
  IconDownload,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconVolume,
  IconVolumeOff,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useComputedColorScheme, useMantineTheme } from '@mantine/core';
import type { AudioActionLink } from '@/lib/media/audio-view-model';
import type { WaveformPeaks } from '@/lib/media/waveform-sidecar';
import { useAudioPlaybackController } from './useAudioPlaybackController';
import './ui/MediaPlayer.css';
import './ui/AudioPlayer.css';

interface AudioPlayerProps {
  src: string;
  hlsSrc?: string;
  name?: string;
  isReady?: boolean;
  duration?: number;
  waveform?: WaveformPeaks;
  waveformUrl?: string;
  actions?: AudioActionLink[];
  action?: ReactNode;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(1, value));
}

function AudioPlayerIcon({ kind }: { kind: 'play' | 'pause' | 'volume' | 'mute' }) {
  let icon: ReactNode = null;
  if (kind === 'play') {
    icon = <IconPlayerPlayFilled size={18} />;
  } else if (kind === 'pause') {
    icon = <IconPlayerPauseFilled size={18} />;
  } else if (kind === 'volume') {
    icon = <IconVolume size={16} />;
  } else {
    icon = <IconVolumeOff size={16} />;
  }

  return <span className={`audio-player__icon audio-player__icon--${kind}`}>{icon}</span>;
}

export function AudioPlayer({
  src,
  hlsSrc,
  name,
  isReady = true,
  duration: initialDuration,
  waveform,
  waveformUrl,
  actions = [],
  action,
}: AudioPlayerProps) {
  const tMedia = useTranslations('editorCommon.media');
  const theme = useMantineTheme();
  const colorScheme = useComputedColorScheme();
  const {
    audioRef,
    waveRef,
    safeSrc,
    safeHlsSrc,
    canPlay,
    hasPlayableMedia,
    isPlaying,
    isMuted,
    volume,
    displayCurrentTime,
    duration: resolvedDuration,
    isWaveReady,
    showWaveLoading,
    handleAudioError,
    handleTrackClick,
    handleTrackKeyDown,
    handleVolumeChange,
    togglePlay,
    toggleMute,
  } = useAudioPlaybackController({
    src,
    hlsSrc,
    waveform,
    waveformUrl,
    duration: initialDuration,
    isReady,
  });
  const accent = theme.colors[theme.primaryColor]?.[6] || theme.colors.blue?.[6] || '#228be6';
  const accentSoft = theme.colors[theme.primaryColor]?.[4] || theme.colors.blue?.[4] || '#4dabf7';
  const waveColor = colorScheme === 'dark' ? 'rgb(255 255 255 / 18%)' : 'rgb(15 23 42 / 14%)';
  const progressColor = accent;
  const cursorColor = colorScheme === 'dark' ? 'rgb(255 255 255 / 90%)' : 'rgb(15 23 42 / 88%)';
  return (
    <div
      className="audio-player geul-media-player"
      data-audio-player="true"
      data-audio-player-ready={canPlay ? 'true' : 'false'}
      data-audio-player-playing={isPlaying ? 'true' : 'false'}
      data-audio-player-view="waveform"
      style={
        {
          '--audio-wave-color': waveColor,
          '--audio-progress-color': progressColor,
          '--audio-progress-color-soft': accentSoft,
          '--audio-cursor-color': cursorColor,
        } as CSSProperties
      }
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        className="audio-player__media"
        src={!safeHlsSrc ? safeSrc || undefined : undefined}
        preload="metadata"
        crossOrigin="anonymous"
        onError={handleAudioError}
      />

      <div className="audio-player__main">
        <div className="audio-player__surface">
          <div className="audio-player__content">
            <div className="audio-player__visual">
              <div
                className="audio-player__view-panel audio-player__view-panel--waveform"
                data-audio-player-view-panel="waveform"
              >
                <div className="audio-player__wave-shell">
                  <div
                    className="audio-player__wave-frame"
                    onClick={handleTrackClick}
                    onKeyDown={handleTrackKeyDown}
                    role="button"
                    tabIndex={0}
                    aria-label={tMedia('audioPlayer.seekPlayback')}
                  >
                    <div
                      ref={waveRef}
                      className="audio-player__wave"
                      data-audio-player-wave="true"
                      data-audio-player-wave-ready={isWaveReady ? 'true' : 'false'}
                    />
                    {showWaveLoading ? (
                      <div
                        className="audio-player__wave-loading"
                        data-audio-player-wave-loading="true"
                        aria-hidden={isWaveReady ? 'true' : 'false'}
                      >
                        <span className="audio-player__wave-loading-spinner" aria-hidden="true" />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="audio-player__footer">
              <div className="audio-player__controls">
                <button
                  type="button"
                  className="audio-player__control-button audio-player__toggle"
                  onClick={togglePlay}
                  disabled={!canPlay}
                  data-audio-player-toggle="true"
                  aria-label={isPlaying ? tMedia('audioPlayer.pause') : tMedia('audioPlayer.play')}
                  title={name || tMedia('audioPlayer.playback')}
                >
                  <AudioPlayerIcon kind="play" />
                  <AudioPlayerIcon kind="pause" />
                </button>

                <button
                  type="button"
                  className="audio-player__control-button audio-player__mute"
                  onClick={toggleMute}
                  disabled={!hasPlayableMedia}
                  aria-label={isMuted ? tMedia('audioPlayer.unmute') : tMedia('audioPlayer.mute')}
                  data-audio-player-mute="true"
                  data-muted={isMuted ? 'true' : 'false'}
                >
                  <AudioPlayerIcon kind="volume" />
                  <AudioPlayerIcon kind="mute" />
                </button>

                <input
                  className="audio-player__volume"
                  data-audio-player-volume="true"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={handleVolumeChange}
                  disabled={!hasPlayableMedia}
                  aria-label={tMedia('audioPlayer.volume')}
                  style={
                    {
                      '--audio-volume-progress': `${clampProgress(volume) * 100}%`,
                    } as CSSProperties
                  }
                />
              </div>

              <div className="audio-player__meta">
                <span className="audio-player__time audio-player__time--current" data-audio-player-current-time="true">
                  {formatTime(displayCurrentTime)}
                </span>
                <span className="audio-player__time-separator" aria-hidden="true">
                  /
                </span>
                <span className="audio-player__time audio-player__time--duration" data-audio-player-duration="true">
                  {resolvedDuration > 0 ? formatTime(resolvedDuration) : '--:--'}
                </span>
              </div>

              <div className="audio-player__toolbar">
                {action}
                {actions.map((action) => (
                  <a
                    key={action.key}
                    className="audio-player__control-button audio-player__download-button"
                    href={action.href}
                    download={action.download}
                    target={action.target}
                    rel={action.rel}
                    data-audio-player-download={action.key}
                    aria-label={tMedia('audioPlayer.download')}
                    title={tMedia('audioPlayer.download')}
                  >
                    <IconDownload size={14} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
