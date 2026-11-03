'use client';

import 'video.js/dist/video-js.css';
import { RefObject, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { resolveHydratedAudioSources, resolveHydratedVideoSources } from '@/features/media/runtime/media-hydration';
import { buildVideoJsMessages } from '@/features/media/runtime/videojs-messages';
import { loadVideoJsRuntime } from '@/features/media/runtime/videojs-loader';
import { resolveVideoPlaybackSource, type VideoJsMessages } from '@/features/media/runtime/videojs-source';
import {
  clampMediaTime,
  normalizeHydrationUrl,
  resolvePlaybackProgress,
  resolveSeekTimeFromClientX,
} from '@/lib/media/shared';
import { fetchWaveformData, type WaveformPeaks } from '@/lib/media/waveform-sidecar';
import { mountWaveSurferPlayer } from '@/lib/media/wavesurfer-player';
import { updateNativeRangeValue } from '@/components/core/Input/native-range';
import {
  applyAudioMediaPresentation,
  applyAudioSeekPresentation,
  applyVideoFramePresentation,
  resolveMediaSeekKey,
} from '@/components/core/MediaControls';
import { applyVisuallyHiddenPresentation } from '@/components/core/Typography/dom-text';

interface MediaBlockHydratorProps {
  containerRef: RefObject<HTMLElement | null>;
  contentKey?: string | null;
}

interface HydrationEntry {
  cleanup: () => void;
  signature: string;
}

const HYDRATED_SIGNATURE_ATTR = 'data-media-hydrated-signature';
let nextAudioStatusId = 0;

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
  const frame = video.closest<HTMLElement>('.video-player-container');
  const mediaBlock = video.closest<HTMLElement>('.video-block-html, .video-block');
  const mediaName =
    mediaBlock?.getAttribute('data-media-name') ||
    mediaBlock?.querySelector('.video-block__title')?.textContent ||
    messages.regionLabel;
  video.setAttribute('aria-label', mediaName);
  if (frame) {
    frame.setAttribute('role', 'group');
    frame.setAttribute('aria-label', mediaName);
  }
  const playerMessages = { ...messages, regionLabel: mediaName };
  if (frame) {
    applyVideoFramePresentation(frame);
  }
  const block = video.closest<HTMLElement>('.video-block-html, .video-block');
  const { hlsSrc, originalUrl, posterUrl } = resolveHydratedVideoSources({
    block,
    video,
  });

  if (!normalizeHydrationUrl(video.getAttribute('poster')) && posterUrl) {
    video.poster = posterUrl;
  }

  if (!resolveVideoPlaybackSource({ hlsSrc, src: originalUrl })) {
    video.removeAttribute('src');
    video.load();
    return () => {};
  }

  let cancelled = false;
  let dispose: (() => void) | null = null;
  const signature = buildVideoSignature(video, block);
  void loadVideoJsRuntime()
    .then((runtime) => {
      if (cancelled || !video.isConnected || buildVideoSignature(video, block) !== signature) {
        return;
      }
      const player = runtime.mountVideoJsPlayer(video, {
        hlsSrc,
        src: originalUrl,
        poster: posterUrl,
        messages: playerMessages,
      });
      dispose = () => runtime.disposeVideoJsPlayer(player || undefined);
    })
    .catch(() => {
      // Preserve the static video fallback if the runtime chunk fails to load.
      if (!cancelled && video.isConnected && buildVideoSignature(video, block) === signature) {
        video.controls = true;
        video.src = resolveVideoPlaybackSource({ src: originalUrl })?.src || hlsSrc;
      }
    });

  return () => {
    cancelled = true;
    dispose?.();
  };
}

function hydrateAudio(
  audio: HTMLAudioElement,
  messages: {
    play: string;
    pause: string;
    mute: string;
    unmute: string;
    volume: string;
    download: string;
    seek: string;
    failed: string;
  },
) {
  const block = audio.closest<HTMLElement>('.audio-block-html, .audio-block');
  const player = block?.querySelector<HTMLElement>('.audio-player[data-audio-player]');
  if (player) {
    applyAudioMediaPresentation(player);
    player.setAttribute('role', 'group');
    player.setAttribute(
      'aria-label',
      block?.getAttribute('data-media-name') ||
        block?.querySelector('.audio-block__title')?.textContent ||
        messages.play,
    );
  }
  const playbackStatus = player
    ? (player.querySelector<HTMLElement>('[data-audio-player-status]') ?? document.createElement('span'))
    : null;
  if (playbackStatus && player) {
    playbackStatus.id ||= `audio-playback-status-${++nextAudioStatusId}`;
    playbackStatus.setAttribute('data-audio-player-status', 'true');
    playbackStatus.setAttribute('role', 'status');
    playbackStatus.setAttribute('aria-live', 'polite');
    playbackStatus.setAttribute('aria-atomic', 'true');
    applyVisuallyHiddenPresentation(playbackStatus);
    if (!playbackStatus.parentElement) {
      player.appendChild(playbackStatus);
    }
  }
  const toggle = player?.querySelector<HTMLButtonElement>('[data-audio-player-toggle]');
  const playbackReady = toggle ? !toggle.disabled : true;
  const mute = player?.querySelector<HTMLButtonElement>('[data-audio-player-mute]');
  const volumeInput = player?.querySelector<HTMLInputElement>('[data-audio-player-volume]');
  volumeInput?.setAttribute('aria-label', messages.volume);
  player?.querySelectorAll<HTMLElement>('[data-audio-player-download]').forEach((link) => {
    link.setAttribute('aria-label', messages.download);
    link.setAttribute('title', messages.download);
  });
  const currentTimeEl = player?.querySelector<HTMLElement>('[data-audio-player-current-time]');
  const durationEl = player?.querySelector<HTMLElement>('[data-audio-player-duration]');
  const track = player?.querySelector<HTMLElement>('[data-audio-player-track], .audio-player__wave-frame');
  let renderedTime = 0;
  let seekInput = track
    ? applyAudioSeekPresentation(track, {
        label: messages.seek,
        currentTime: 0,
        duration: parseFloat(block?.getAttribute('data-duration') || '0') || 0,
        disabled: !playbackReady,
      })
    : null;
  const trackFill = player?.querySelector<HTMLElement>('[data-audio-player-track-fill]');
  const trackThumb = player?.querySelector<HTMLElement>('[data-audio-player-track-thumb]');
  const waveContainer = player?.querySelector<HTMLElement>('[data-audio-player-wave]');
  waveContainer?.setAttribute('aria-hidden', 'true');
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
  let playbackHasError = false;
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
    const duration = Number.isFinite(nextDuration) && nextDuration > 0 ? nextDuration : 0;
    const currentTime = clampMediaTime(nextTime, duration);
    const progress = resolvePlaybackProgress(currentTime, duration);
    const playbackProgress = `${progress * 100}%`;
    if (playbackStatus) {
      const message = playbackHasError ? messages.failed : '';
      if (playbackStatus.textContent !== message) {
        playbackStatus.textContent = message;
      }
      const descriptions = (player?.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter((id) => id && id !== playbackStatus.id);
      if (playbackHasError) {
        descriptions.push(playbackStatus.id);
      }
      if (descriptions.length) {
        player?.setAttribute('aria-describedby', descriptions.join(' '));
      } else {
        player?.removeAttribute('aria-describedby');
      }
    }
    renderedTime = currentTime;
    if (track) {
      seekInput = applyAudioSeekPresentation(track, {
        label: messages.seek,
        currentTime,
        duration,
        disabled: playbackHasError || !playbackReady,
        describedBy: playbackHasError && playbackStatus ? playbackStatus.id : undefined,
      });
    }
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
      player.setAttribute('data-audio-player-playing', audio.paused ? 'false' : 'true');
      player.setAttribute(
        'data-audio-player-ready',
        normalizeHydrationUrl(audio.getAttribute('src')) || playbackUrl || hlsSrc ? 'true' : 'false',
      );
    }
    if (toggle) {
      toggle.setAttribute('aria-label', audio.paused ? messages.play : messages.pause);
      toggle.disabled = playbackHasError || !playbackReady;
    }
    if (mute) {
      mute.setAttribute('data-muted', audio.muted || audio.volume === 0 ? 'true' : 'false');
      mute.setAttribute('aria-label', audio.muted || audio.volume === 0 ? messages.unmute : messages.mute);
    }
    if (volumeInput) {
      const volumeValue = audio.muted ? 0 : audio.volume;
      updateNativeRangeValue(volumeInput, volumeValue);
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
        if (cancelled) {
          return;
        }
        waveContainer.setAttribute('data-audio-player-wave-ready', state.isReady ? 'true' : 'false');
      },
      onPositionChange: (state) => {
        if (cancelled) {
          return;
        }
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
        if (cancelled) {
          return;
        }
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
    if (playbackHasError || !playbackReady || !Number.isFinite(duration) || !(duration > 0)) {
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
    const duration = resolveDuration();
    const nextTime = resolveSeekTimeFromClientX(track, event.clientX, duration);
    if (nextTime === null) {
      return;
    }
    seekToTime(nextTime);
  };

  const handleToggleClick = () => {
    if (
      playbackHasError ||
      !playbackReady ||
      (!normalizeHydrationUrl(audio.getAttribute('src')) && !playbackUrl && !hlsSrc)
    ) {
      return;
    }
    if (audio.paused) {
      audio.play().catch(() => {});
      return;
    }
    audio.pause();
  };

  const handleSeekKeyDown = (event: KeyboardEvent) => {
    const result = resolveMediaSeekKey(event.key, renderedTime, resolveDuration());
    if (!result) {
      return;
    }
    event.preventDefault();
    if (result.kind === 'seek') {
      seekToTime(result.time);
    } else {
      handleToggleClick();
    }
  };
  const handleSeekInput = () => {
    if (seekInput) {
      seekToTime(Number(seekInput.value));
    }
  };
  const handleMediaError = () => {
    playbackHasError = true;
    stopPlaybackClock();
    renderPlayer();
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
    playbackHasError = false;
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
  audio.addEventListener('error', handleMediaError);
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
  seekInput?.addEventListener('keydown', handleSeekKeyDown);
  seekInput?.addEventListener('input', handleSeekInput);

  return () => {
    cancelled = true;
    stopPlaybackClock();
    mountedWaveSurfer?.destroy();
    audio.removeEventListener('error', handleMediaError);
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
    seekInput?.removeEventListener('keydown', handleSeekKeyDown);
    seekInput?.removeEventListener('input', handleSeekInput);
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
            volume: tMedia('audioPlayer.volume'),
            download: tMedia('audioPlayer.download'),
            seek: tMedia('audioPlayer.seekPlayback'),
            failed: tMedia('statuses.failed'),
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
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-hls-src', 'data-hls-url', 'data-original-url', 'data-poster-url', 'data-file-id'],
    });

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
