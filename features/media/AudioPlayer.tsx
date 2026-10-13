'use client';

import { useId, type ReactNode } from 'react';
import { VisuallyHidden } from '@/components/core/Typography';
import { IconDownload } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { IconButton } from '@/components/core/IconButton';
import { MediaAudioFrame, MediaTransport, MediaWaveformSeek } from '@/components/core/MediaControls';
import type { AudioActionLink } from '@/lib/media/audio-view-model';
import type { WaveformPeaks } from '@/lib/media/waveform-sidecar';
import { useAudioPlaybackController } from './useAudioPlaybackController';

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
  const playbackStatusId = useId();
  const {
    audioRef,
    waveRef,
    safeSrc,
    safeHlsSrc,
    canPlay,
    playbackHasError,
    hasPlayableMedia,
    isPlaying,
    isMuted,
    volume,
    displayCurrentTime,
    duration: resolvedDuration,
    isWaveReady,
    showWaveLoading,
    handleAudioError,
    seek,
    applyVolume,
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
  return (
    <MediaAudioFrame
      playing={isPlaying}
      ready={canPlay}
      role="group"
      aria-label={name || tMedia('audioPlayer.playback')}
      aria-describedby={playbackHasError ? playbackStatusId : undefined}
    >
      <VisuallyHidden id={playbackStatusId} role="status" aria-live="polite" aria-atomic="true">
        {playbackHasError ? tMedia('statuses.failed') : ''}
      </VisuallyHidden>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        className="audio-player__media"
        src={!safeHlsSrc ? safeSrc || undefined : undefined}
        preload="metadata"
        crossOrigin="anonymous"
        onError={handleAudioError}
      />
      <MediaWaveformSeek
        label={tMedia('audioPlayer.seekPlayback')}
        currentTime={displayCurrentTime}
        duration={resolvedDuration}
        disabled={!canPlay}
        waveRef={waveRef}
        waveReady={isWaveReady}
        loading={showWaveLoading}
        aria-describedby={playbackHasError ? playbackStatusId : undefined}
        onSeek={seek}
        onTogglePlayback={togglePlay}
      />
      <MediaTransport
        labels={{
          play: tMedia('audioPlayer.play'),
          pause: tMedia('audioPlayer.pause'),
          mute: tMedia('audioPlayer.mute'),
          unmute: tMedia('audioPlayer.unmute'),
          volume: tMedia('audioPlayer.volume'),
        }}
        playing={isPlaying}
        muted={isMuted}
        volume={volume}
        currentTime={displayCurrentTime}
        duration={resolvedDuration}
        playbackDisabled={!canPlay}
        volumeDisabled={!hasPlayableMedia}
        onPlay={togglePlay}
        onMute={toggleMute}
        onVolumeChange={applyVolume}
        playbackTitle={name || tMedia('audioPlayer.playback')}
        actions={
          <>
            {action}
            {actions.map((item) => (
              <IconButton
                key={item.key}
                label={tMedia('audioPlayer.download')}
                href={item.href}
                download={item.download}
                target={item.target}
                rel={item.rel}
                size="chrome"
                data-audio-player-download={item.key}
              >
                <IconDownload />
              </IconButton>
            ))}
          </>
        }
      />
    </MediaAudioFrame>
  );
}
