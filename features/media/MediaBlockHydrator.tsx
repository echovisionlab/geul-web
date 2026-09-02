'use client';

import { RefObject, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { resolveHydratedAudioSources, resolveHydratedVideoSources } from '@/features/media/runtime/media-hydration';
import { buildVideoJsMessages } from '@/features/media/runtime/videojs-messages';
import {
  disposeVideoJsPlayer,
  mountVideoJsPlayer,
  type VideoJsMessages,
} from '@/features/media/runtime/videojs-player';
import {
  clampMediaTime,
  normalizeHydrationUrl,
  resolvePlaybackProgress,
  resolveSeekTimeFromClientX,
} from '@/lib/media/shared';
import { fetchWaveformData, type WaveformPeaks } from '@/lib/media/waveform-sidecar';
import { mountWaveSurferPlayer } from '@/lib/media/wavesurfer-player';
import './ui/MediaPlayer.css';
import './ui/AudioPlayer.css';
import './ui/VideoPlayer.css';

interface MediaBlockHydratorProps {
  containerRef: RefObject<HTMLElement | null>;
  contentKey?: string | null;
}

interface HydrationEntry {
  cleanup: () => void;
  signature: string;
}

const HYDRATED_SIGNATURE_ATTR = 'data-media-hydrated-signature';

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function removeInvalidTracks(container: HTMLElement) {
  const tracks = container.querySelectorAll('video track, audio track');
  tracks.forEach((track) => {
    const src = normalizeHydrationUrl(track.getAttribute('src'));
    if (!src) {
      track.remove();
    }
  });
}

function buildVideoSignature(video: HTMLVideoElement, block: HTMLElement | null): string {
  const { hlsSrc, originalUrl, posterUrl } = resolveHydratedVideoSources({
    block,
    video,
  });
  return [hlsSrc, originalUrl, posterUrl, block?.getAttribute('data-file-id') || ''].join('|');
}

function buildAudioSignature(audio: HTMLAudioElement, block: HTMLElement | null): string {
  const { playbackUrl, hlsSrc } = resolveHydratedAudioSources({ block, audio });
  const resolvedSrc = normalizeHydrationUrl(audio.getAttribute('src')) || playbackUrl;
  return [
    resolvedSrc,
    hlsSrc,
    block?.getAttribute('data-waveform-url') || '',
    block?.getAttribute('data-duration') || '',
    block?.getAttribute('data-file-id') || '',
  ].join('|');
}

function hydrateVideo(video: HTMLVideoElement, messages: VideoJsMessages) {
  const block = video.closest<HTMLElement>('.video-block-html, .video-block');
  const { hlsSrc, originalUrl, posterUrl } = resolveHydratedVideoSources({
    block,
    video,
  });

  if (!normalizeHydrationUrl(video.getAttribute('poster')) && posterUrl) {
    video.poster = posterUrl;
  }

  const player = mountVideoJsPlayer(video, {
    hlsSrc,
    src: originalUrl,
    poster: posterUrl,
    messages,
  });

  if (!player && (hlsSrc || originalUrl)) {
    return null;
  }

  if (!player && !hlsSrc && !originalUrl) {
    video.removeAttribute('src');
    video.load();
  }

  return () => {
    disposeVideoJsPlayer(player || undefined);
  };
}

function hydrateAudio(
  audio: HTMLAudioElement,
  messages: {
    play: string;
    pause: string;
    mute: string;
    unmute: string;
  },
) {
  const block = audio.closest<HTMLElement>('.audio-block-html, .audio-block');
  const player = block?.querySelector<HTMLElement>('.audio-player[data-audio-player]');
  const toggle = player?.querySelector<HTMLButtonElement>('[data-audio-player-toggle]');
  const mute = player?.querySelector<HTMLButtonElement>('[data-audio-player-mute]');
  const volumeInput = player?.querySelector<HTMLInputElement>('[data-audio-player-volume]');
  const currentTimeEl = player?.querySelector<HTMLElement>('[data-audio-player-current-time]');
  const durationEl = player?.querySelector<HTMLElement>('[data-audio-player-duration]');
  const track = player?.querySelector<HTMLButtonElement>('[data-audio-player-track]');
  const trackFill = player?.querySelector<HTMLElement>('[data-audio-player-track-fill]');
  const trackThumb = player?.querySelector<HTMLElement>('[data-audio-player-track-thumb]');
  const waveContainer = player?.querySelector<HTMLElement>('[data-audio-player-wave]');
  const waveformUrl = normalizeHydrationUrl(block?.getAttribute('data-waveform-url'));
  const { playbackUrl, hlsSrc } = resolveHydratedAudioSources({
    block,
    audio,
  });

  if (!normalizeHydrationUrl(audio.getAttribute('src')) && playbackUrl && !hlsSrc) {
    audio.src = playbackUrl;
  }
  if (!normalizeHydrationUrl(audio.getAttribute('src')) && !playbackUrl && !hlsSrc) {
    return null;
  }

  let mountedWaveSurfer: Awaited<ReturnType<typeof mountWaveSurferPlayer>> = null;
  let cancelled = false;
  let lastAudibleVolume = audio.volume > 0 ? audio.volume : 1;
  let playbackFrameId: number | null = null;
  const fallbackDuration = parseFloat(block?.getAttribute('data-duration') || '0') || 0;

  const resolveDuration = () => mountedWaveSurfer?.getDuration() || audio.duration || fallbackDuration;

  const stopPlaybackClock = () => {
    if (playbackFrameId !== null) {
      window.cancelAnimationFrame(playbackFrameId);
      playbackFrameId = null;
    }
  };

  const renderPlayer = (nextTime = audio.currentTime, nextDuration = resolveDuration()) => {
    const duration = nextDuration > 0 ? nextDuration : 0;
    const currentTime = clampMediaTime(nextTime, duration);
    const progress = resolvePlaybackProgress(currentTime, duration);
    const playbackProgress = `${progress * 100}%`;
    if (trackFill) {
      trackFill.style.width = playbackProgress;
    }
    if (trackThumb) {
      trackThumb.style.left = playbackProgress;
    }
    if (currentTimeEl) {
      currentTimeEl.textContent = formatTime(currentTime);
    }
    if (durationEl) {
      durationEl.textContent = duration > 0 ? formatTime(duration) : '--:--';
    }
    if (player) {
      player.style.setProperty('--audio-playback-progress', playbackProgress);
      player.setAttribute('data-audio-player-playing', audio.paused ? 'false' : 'true');
      player.setAttribute(
        'data-audio-player-ready',
        normalizeHydrationUrl(audio.getAttribute('src')) || playbackUrl || hlsSrc ? 'true' : 'false',
      );
    }
    if (toggle) {
      toggle.setAttribute('aria-label', audio.paused ? messages.play : messages.pause);
    }
    if (mute) {
      mute.setAttribute('data-muted', audio.muted || audio.volume === 0 ? 'true' : 'false');
      mute.setAttribute('aria-label', audio.muted || audio.volume === 0 ? messages.unmute : messages.mute);
    }
    if (volumeInput) {
      const volumeValue = audio.muted ? 0 : audio.volume;
      volumeInput.value = `${volumeValue}`;
      volumeInput.style.setProperty('--audio-volume-progress', `${Math.max(0, Math.min(1, volumeValue)) * 100}%`);
    }
    if (audio.volume > 0) {
      lastAudibleVolume = audio.volume;
    }
  };

  const startPlaybackClock = () => {
    stopPlaybackClock();
    const tick = () => {
      renderPlayer(audio.currentTime, resolveDuration());
      if (!audio.paused && !audio.ended) {
        playbackFrameId = window.requestAnimationFrame(tick);
      } else {
        playbackFrameId = null;
      }
    };
    playbackFrameId = window.requestAnimationFrame(tick);
  };

  const mountWave = (peaks?: WaveformPeaks) => {
    if (!waveContainer || (!normalizeHydrationUrl(audio.getAttribute('src')) && !playbackUrl && !hlsSrc)) {
      return;
    }
    waveContainer.setAttribute('data-audio-player-wave-ready', 'false');
    void mountWaveSurferPlayer({
      audio,
      container: waveContainer,
      src: playbackUrl,
      hlsSrc,
      waveform: peaks,
      duration: parseFloat(block?.getAttribute('data-duration') || '0') || undefined,
      interactive: true,
      onStateChange: (state) => {
        waveContainer.setAttribute('data-audio-player-wave-ready', state.isReady ? 'true' : 'false');
      },
      onPositionChange: (state) => {
        renderPlayer(state.currentTime, state.duration);
        if (state.isPlaying) {
          startPlaybackClock();
        }
      },
    })
      .then((mounted) => {
        if (cancelled) {
          mounted?.destroy();
          return;
        }
        mountedWaveSurfer = mounted;
        waveContainer.setAttribute('data-audio-player-wave-ready', mounted ? 'true' : 'false');
        renderPlayer();
      })
      .catch(() => {
        mountedWaveSurfer = null;
        waveContainer.setAttribute('data-audio-player-wave-ready', 'false');
      });
  };

  if (waveContainer && (normalizeHydrationUrl(audio.getAttribute('src')) || playbackUrl || hlsSrc)) {
    if (waveformUrl) {
      waveContainer.setAttribute('data-audio-player-wave-ready', 'false');
      void fetchWaveformData(waveformUrl)
        .then((peaks) => {
          if (cancelled) {
            return;
          }
          mountWave(peaks);
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          mountWave();
        });
    } else {
      mountWave();
    }
  }

  const seekToTime = (nextTime: number) => {
    const duration = resolveDuration();
    if (!(duration > 0)) {
      return;
    }

    const clampedTime = clampMediaTime(nextTime, duration);
    renderPlayer(clampedTime, duration);
    if (mountedWaveSurfer) {
      mountedWaveSurfer.setTime(clampedTime);
    } else {
      audio.currentTime = clampedTime;
    }
  };

  const handleTrackClick = (event: MouseEvent) => {
    if (!track) {
      return;
    }
    const duration = mountedWaveSurfer?.getDuration() || audio.duration || 0;
    const nextTime = resolveSeekTimeFromClientX(track, event.clientX, duration);
    if (nextTime === null) {
      return;
    }
    seekToTime(nextTime);
  };

  const handleToggleClick = () => {
    if (!normalizeHydrationUrl(audio.getAttribute('src'))) {
      return;
    }
    if (audio.paused) {
      audio.play().catch(() => {});
      return;
    }
    audio.pause();
  };

  const handleMuteClick = () => {
    if (audio.muted || audio.volume === 0) {
      audio.muted = false;
      audio.volume = lastAudibleVolume || 0.85;
    } else {
      lastAudibleVolume = audio.volume > 0 ? audio.volume : lastAudibleVolume;
      audio.muted = true;
      audio.volume = 0;
    }
    renderPlayer();
  };

  const handleVolumeInput = () => {
    if (!volumeInput) {
      return;
    }
    const nextVolume = Math.max(0, Math.min(1, parseFloat(volumeInput.value) || 0));
    audio.volume = nextVolume;
    audio.muted = nextVolume <= 0.001;
    if (nextVolume > 0) {
      lastAudibleVolume = nextVolume;
    }
    renderPlayer();
  };

  const handleLoadedMetadata = () => {
    renderPlayer();
  };

  const handleTimeUpdate = () => {
    renderPlayer();
  };

  const handleSeeking = () => {
    renderPlayer();
  };

  const handlePlay = () => {
    renderPlayer();
    startPlaybackClock();
  };

  const handlePause = () => {
    stopPlaybackClock();
    renderPlayer();
  };

  const handleEnded = () => {
    stopPlaybackClock();
    renderPlayer(0, resolveDuration());
  };

  renderPlayer();
  audio.addEventListener('loadedmetadata', handleLoadedMetadata);
  audio.addEventListener('timeupdate', handleTimeUpdate);
  audio.addEventListener('seeking', handleSeeking);
  audio.addEventListener('seeked', handleTimeUpdate);
  audio.addEventListener('play', handlePlay);
  audio.addEventListener('pause', handlePause);
  audio.addEventListener('ended', handleEnded);
  toggle?.addEventListener('click', handleToggleClick);
  mute?.addEventListener('click', handleMuteClick);
  volumeInput?.addEventListener('input', handleVolumeInput);
  volumeInput?.addEventListener('change', handleVolumeInput);
  track?.addEventListener('click', handleTrackClick);

  return () => {
    cancelled = true;
    stopPlaybackClock();
    mountedWaveSurfer?.destroy();
    audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    audio.removeEventListener('timeupdate', handleTimeUpdate);
    audio.removeEventListener('seeking', handleSeeking);
    audio.removeEventListener('seeked', handleTimeUpdate);
    audio.removeEventListener('play', handlePlay);
    audio.removeEventListener('pause', handlePause);
    audio.removeEventListener('ended', handleEnded);
    toggle?.removeEventListener('click', handleToggleClick);
    mute?.removeEventListener('click', handleMuteClick);
    volumeInput?.removeEventListener('input', handleVolumeInput);
    volumeInput?.removeEventListener('change', handleVolumeInput);
    track?.removeEventListener('click', handleTrackClick);
  };
}

export function MediaBlockHydrator({ containerRef, contentKey }: MediaBlockHydratorProps) {
  const tMedia = useTranslations('editorCommon.media');
  const locale = useLocale();
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const audioEntries = new Map<HTMLAudioElement, HydrationEntry>();
    const videoEntries = new Map<HTMLElement, HydrationEntry>();
    let frameId: number | null = null;

    const cleanupEntryMaps = () => {
      audioEntries.forEach((entry) => entry.cleanup());
      audioEntries.clear();
      videoEntries.forEach((entry) => entry.cleanup());
      videoEntries.clear();
    };

    const syncMedia = () => {
      removeInvalidTracks(container);

      const activeVideoBlocks = new Set<HTMLElement>();
      const videoBlocks = container.querySelectorAll<HTMLElement>('.video-block-html, .video-block');
      videoBlocks.forEach((block) => {
        const existing = videoEntries.get(block);
        const video = block.querySelector<HTMLVideoElement>('video');
        if (!video) {
          if (existing && block.isConnected) {
            activeVideoBlocks.add(block);
          }
          return;
        }
        activeVideoBlocks.add(block);
        const signature = buildVideoSignature(video, block);

        if (existing && existing.signature === signature && block.getAttribute(HYDRATED_SIGNATURE_ATTR) === signature) {
          return;
        }

        existing?.cleanup();
        const cleanup = hydrateVideo(video, buildVideoJsMessages(locale, tMedia));
        if (!cleanup) {
          return;
        }
        block.setAttribute(HYDRATED_SIGNATURE_ATTR, signature);
        videoEntries.set(block, { cleanup, signature });
      });

      videoEntries.forEach((entry, block) => {
        if (activeVideoBlocks.has(block) && block.isConnected) {
          return;
        }
        entry.cleanup();
        videoEntries.delete(block);
      });

      const activeAudios = new Set<HTMLAudioElement>();
      const audios = container.querySelectorAll<HTMLAudioElement>('audio[data-file-id]');
      audios.forEach((audio) => {
        activeAudios.add(audio);
        const block = audio.closest<HTMLElement>('.audio-block-html, .audio-block');
        const player = block?.querySelector<HTMLElement>('.audio-player[data-audio-player]');
        const signature = buildAudioSignature(audio, block);
        const existing = audioEntries.get(audio);
        const isMarked =
          audio.getAttribute(HYDRATED_SIGNATURE_ATTR) === signature &&
          player?.getAttribute(HYDRATED_SIGNATURE_ATTR) === signature;

        if (existing && existing.signature === signature && isMarked) {
          return;
        }

        existing?.cleanup();
        const cleanup =
          hydrateAudio(audio, {
            play: tMedia('audioPlayer.play'),
            pause: tMedia('audioPlayer.pause'),
            mute: tMedia('audioPlayer.mute'),
            unmute: tMedia('audioPlayer.unmute'),
          }) || (() => {});
        audio.setAttribute(HYDRATED_SIGNATURE_ATTR, signature);
        player?.setAttribute(HYDRATED_SIGNATURE_ATTR, signature);
        audioEntries.set(audio, { cleanup, signature });
      });

      audioEntries.forEach((entry, audio) => {
        if (activeAudios.has(audio) && audio.isConnected) {
          return;
        }
        entry.cleanup();
        audioEntries.delete(audio);
      });

      removeInvalidTracks(container);
    };

    const scheduleSync = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        try {
          syncMedia();
        } catch {
          // Non-fatal hydration failure: keep static HTML as fallback.
        }
      });
    };

    scheduleSync();

    const observer = new MutationObserver(() => {
      scheduleSync();
    });
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      cleanupEntryMaps();
    };
  }, [containerRef, contentKey, locale, tMedia]);

  return null;
}
