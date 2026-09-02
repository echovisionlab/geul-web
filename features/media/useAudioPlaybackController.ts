'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { normalizeHydrationUrl } from '@echovisionlab/geul-common/media/hydration';
import { clampMediaTime, resolveSeekTimeFromClientX } from '@/lib/media/shared';
import { fetchWaveformData, type WaveformPeaks } from '@/lib/media/waveform-sidecar';
import { mountWaveSurferPlayer, type MountedWaveSurferPlayer } from '@/lib/media/wavesurfer-player';

interface UseAudioPlaybackControllerOptions {
  src: string;
  hlsSrc?: string;
  waveform?: WaveformPeaks;
  waveformUrl?: string;
  duration?: number;
  isReady: boolean;
}

function isValidMediaUrl(url: string): boolean {
  if (!url) {
    return false;
  }
  if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) {
    return true;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function useAudioPlaybackController({
  src,
  hlsSrc,
  waveform,
  waveformUrl,
  duration: initialDuration,
  isReady,
}: UseAudioPlaybackControllerOptions) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const mountedWaveSurferRef = useRef<MountedWaveSurferPlayer | null>(null);
  const playbackFrameRef = useRef<number | null>(null);
  const lastAudibleVolumeRef = useRef(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isWaveReady, setIsWaveReady] = useState(false);
  const [waveHasError, setWaveHasError] = useState(false);
  const [resolvedWaveform, setResolvedWaveform] = useState<WaveformPeaks | undefined>(waveform);
  const [isWaveformLoading, setIsWaveformLoading] = useState(false);
  const [displayCurrentTime, setDisplayCurrentTime] = useState(0);

  const markPlaybackUnavailable = useCallback(() => {
    setIsPlaying(false);
    setIsLoaded(false);
  }, []);
  const normalizedSrc = normalizeHydrationUrl(src);
  const normalizedHlsSrc = normalizeHydrationUrl(hlsSrc);
  const safeSrc = isValidMediaUrl(normalizedSrc) ? normalizedSrc : '';
  const safeHlsSrc = isValidMediaUrl(normalizedHlsSrc) ? normalizedHlsSrc : '';

  useEffect(() => {
    setWaveHasError(false);
    setIsWaveReady(false);
    if (!safeSrc && !safeHlsSrc) {
      setIsLoaded(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setDisplayCurrentTime(0);
    }
  }, [safeHlsSrc, safeSrc]);

  useEffect(() => {
    if (waveform?.length) {
      setResolvedWaveform(waveform);
      setIsWaveformLoading(false);
      return;
    }
    if (!waveformUrl) {
      setResolvedWaveform(undefined);
      setIsWaveformLoading(false);
      return;
    }

    let cancelled = false;
    setResolvedWaveform(undefined);
    setIsWaveformLoading(true);
    fetchWaveformData(waveformUrl)
      .then((data) => {
        if (!cancelled) {
          setResolvedWaveform(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedWaveform(undefined);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsWaveformLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [waveformUrl, waveform]);

  useEffect(() => {
    const container = waveRef.current;
    const audio = audioRef.current;
    if (!container || !audio) {
      return;
    }

    mountedWaveSurferRef.current?.destroy();
    mountedWaveSurferRef.current = null;
    container.innerHTML = '';
    setIsWaveReady(false);
    if ((!safeSrc && !safeHlsSrc) || (waveformUrl && isWaveformLoading && !resolvedWaveform?.length)) {
      return;
    }

    let cancelled = false;
    mountWaveSurferPlayer({
      audio,
      container,
      src: safeSrc,
      hlsSrc: safeHlsSrc,
      waveform: resolvedWaveform,
      duration: initialDuration && initialDuration > 0 ? initialDuration : undefined,
      interactive: isReady,
      onStateChange: (state) => {
        if (cancelled) {
          return;
        }
        setCurrentTime(state.currentTime);
        setDuration(state.duration || initialDuration || 0);
        setIsPlaying(state.isPlaying);
        setIsMuted(state.isMuted);
        setIsLoaded(state.isReady || Boolean(safeHlsSrc || safeSrc));
        setIsWaveReady(state.isReady);
      },
      onPositionChange: (state) => {
        if (cancelled) {
          return;
        }
        setCurrentTime(state.currentTime);
        setDuration(state.duration || initialDuration || 0);
        if (!state.isScrubbing) {
          setDisplayCurrentTime(state.currentTime);
        }
      },
    })
      .then((mounted) => {
        if (cancelled) {
          mounted?.destroy();
        } else {
          mountedWaveSurferRef.current = mounted;
          if (!mounted) {
            setIsWaveReady(false);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          mountedWaveSurferRef.current = null;
          setIsWaveReady(false);
          setWaveHasError(true);
        }
      });
    return () => {
      cancelled = true;
      mountedWaveSurferRef.current?.destroy();
      mountedWaveSurferRef.current = null;
      container.innerHTML = '';
    };
  }, [initialDuration, isReady, isWaveformLoading, resolvedWaveform, safeHlsSrc, safeSrc, waveformUrl]);

  useEffect(() => {
    if (initialDuration && initialDuration > 0) {
      setDuration(initialDuration);
    }
  }, [initialDuration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const synchronize = () => {
      setDuration(audio.duration || initialDuration || 0);
      setCurrentTime(audio.currentTime || 0);
      setIsPlaying(!audio.paused);
      setIsMuted(audio.muted || audio.volume === 0);
      setVolume(audio.volume || 0);
      setIsLoaded(audio.readyState >= 1);
      if (audio.volume > 0) {
        lastAudibleVolumeRef.current = audio.volume;
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const events = ['loadedmetadata', 'timeupdate', 'seeking', 'seeked', 'play', 'pause', 'volumechange'] as const;
    events.forEach((event) => audio.addEventListener(event, synchronize));
    audio.addEventListener('ended', handleEnded);
    synchronize();
    return () => {
      events.forEach((event) => audio.removeEventListener(event, synchronize));
      audio.removeEventListener('ended', handleEnded);
    };
  }, [initialDuration, safeHlsSrc, safeSrc]);

  const resolvedDuration = duration || initialDuration || 0;
  const hasPlayableMedia = Boolean(safeHlsSrc || safeSrc);
  const canPlay = isReady && hasPlayableMedia && (isLoaded || hasPlayableMedia) && !waveHasError;
  const synchronizeDisplayTime = useCallback(
    (nextTime: number, mediaDuration = resolvedDuration) => {
      setDisplayCurrentTime(clampMediaTime(nextTime, mediaDuration));
    },
    [resolvedDuration],
  );

  useEffect(() => synchronizeDisplayTime(currentTime), [currentTime, synchronizeDisplayTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!canPlay || !isPlaying || !audio) {
      return;
    }
    const synchronize = () => {
      synchronizeDisplayTime(audio.currentTime, resolvedDuration || audio.duration || 0);
      playbackFrameRef.current = window.requestAnimationFrame(synchronize);
    };
    playbackFrameRef.current = window.requestAnimationFrame(synchronize);
    return () => {
      if (playbackFrameRef.current !== null) {
        window.cancelAnimationFrame(playbackFrameRef.current);
        playbackFrameRef.current = null;
      }
    };
  }, [canPlay, isPlaying, resolvedDuration, synchronizeDisplayTime]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!canPlay || !audio) {
      return;
    }
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [canPlay]);

  const seek = useCallback(
    (nextTime: number) => {
      if (resolvedDuration <= 0) {
        return;
      }
      const clampedTime = clampMediaTime(nextTime, resolvedDuration);
      synchronizeDisplayTime(clampedTime);
      if (mountedWaveSurferRef.current) {
        mountedWaveSurferRef.current.setTime(clampedTime);
      } else if (audioRef.current) {
        audioRef.current.currentTime = clampedTime;
        setCurrentTime(audioRef.current.currentTime);
      }
    },
    [resolvedDuration, synchronizeDisplayTime],
  );

  const handleTrackClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!canPlay || resolvedDuration <= 0) {
        return;
      }
      const nextTime = resolveSeekTimeFromClientX(event.currentTarget, event.clientX, resolvedDuration);
      if (nextTime !== null) {
        seek(nextTime);
      }
    },
    [canPlay, resolvedDuration, seek],
  );
  const handleTrackKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        togglePlay();
      }
    },
    [togglePlay],
  );

  const applyVolume = useCallback((nextVolume: number) => {
    const clamped = clampProgress(nextVolume);
    const nextMuted = clamped <= 0.001;
    if (clamped > 0) {
      lastAudibleVolumeRef.current = clamped;
    }
    const audio = audioRef.current;
    if (audio) {
      audio.muted = nextMuted;
      audio.volume = clamped;
      setIsMuted(nextMuted);
      setVolume(clamped);
    }
  }, []);
  const handleVolumeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => applyVolume(parseFloat(event.currentTarget.value) || 0),
    [applyVolume],
  );
  const toggleMute = useCallback(() => {
    applyVolume(isMuted || volume <= 0.001 ? lastAudibleVolumeRef.current || 0.85 : 0);
  }, [applyVolume, isMuted, volume]);

  return {
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
    showWaveLoading: hasPlayableMedia && !isWaveReady && !waveHasError,
    handleAudioError: markPlaybackUnavailable,
    handleTrackClick,
    handleTrackKeyDown,
    handleVolumeChange,
    togglePlay,
    toggleMute,
  };
}
