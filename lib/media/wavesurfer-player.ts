import { clampMediaTime, normalizeHydrationUrl } from './shared';

export interface WaveSurferPlayerState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isMuted: boolean;
  isReady: boolean;
}

export interface MountWaveSurferPlayerOptions {
  audio: HTMLAudioElement;
  container: HTMLElement;
  src: string;
  hlsSrc?: string;
  waveform?: number[] | number[][];
  duration?: number;
  interactive?: boolean;
  onStateChange?: (state: WaveSurferPlayerState) => void;
  onPositionChange?: (state: {
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    isScrubbing: boolean;
  }) => void;
}

export interface MountedWaveSurferPlayer {
  setTime: (time: number) => void;
  getDuration: () => number;
  destroy: () => void;
}

type WaveSurferModule = typeof import('wavesurfer.js');
type HlsModule = typeof import('hls.js');

function readCssColor(element: HTMLElement, property: string, fallback: string) {
  const value = getComputedStyle(element).getPropertyValue(property).trim();
  return value || fallback;
}

function readWaveSurferColors(container: HTMLElement) {
  const colorRoot = container.closest<HTMLElement>('[data-audio-player]') || container;
  return {
    waveColor: readCssColor(colorRoot, '--audio-wave-color', 'rgba(0, 0, 0, 0.16)'),
    progressColor: readCssColor(colorRoot, '--audio-progress-color', '#1c7ed6'),
    cursorColor: readCssColor(colorRoot, '--audio-cursor-color', 'rgba(15, 23, 42, 0.88)'),
  };
}

function resolveMediaDuration(audio: HTMLMediaElement, durationOverride?: number) {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    return audio.duration;
  }
  return durationOverride && durationOverride > 0 ? durationOverride : 0;
}

function normalizeWaveformPeaks(waveform?: number[] | number[][]) {
  if (!waveform) {
    return undefined;
  }

  if (Array.isArray(waveform) && waveform.every((value) => typeof value === 'number')) {
    return [waveform];
  }

  if (
    Array.isArray(waveform) &&
    waveform.every((channel) => Array.isArray(channel) && channel.every((value) => typeof value === 'number'))
  ) {
    return waveform as number[][];
  }

  return undefined;
}

function readState(audio: HTMLAudioElement, durationOverride?: number): WaveSurferPlayerState {
  return {
    currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
    duration: resolveMediaDuration(audio, durationOverride),
    isPlaying: !audio.paused,
    isMuted: audio.muted || audio.volume === 0,
    isReady: Boolean(normalizeHydrationUrl(audio.currentSrc || audio.src)),
  };
}

export async function mountWaveSurferPlayer(
  options: MountWaveSurferPlayerOptions,
): Promise<MountedWaveSurferPlayer | null> {
  const src = normalizeHydrationUrl(options.src);
  const hlsSrc = normalizeHydrationUrl(options.hlsSrc);
  if ((!src && !hlsSrc) || !options.container || !options.audio) {
    return null;
  }

  const { default: WaveSurfer } = (await import('wavesurfer.js')) as WaveSurferModule;

  const audio = options.audio;
  audio.preload = 'metadata';
  audio.crossOrigin = 'anonymous';
  let cleanupHls: (() => void) | undefined;
  if (hlsSrc) {
    const canPlayNativeHls =
      audio.canPlayType('application/vnd.apple.mpegurl') !== '' || audio.canPlayType('application/x-mpegURL') !== '';

    if (canPlayNativeHls) {
      if (normalizeHydrationUrl(audio.getAttribute('src')) !== hlsSrc) {
        audio.src = hlsSrc;
      }
    } else {
      const { default: Hls } = (await import('hls.js')) as HlsModule;
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(hlsSrc);
        hls.attachMedia(audio);
        cleanupHls = () => hls.destroy();
      } else if (src && normalizeHydrationUrl(audio.getAttribute('src')) !== src) {
        audio.src = src;
      }
    }
  } else if (normalizeHydrationUrl(audio.getAttribute('src')) !== src) {
    audio.src = src;
  }

  const container = options.container;
  container.innerHTML = '';
  const initialColors = readWaveSurferColors(container);
  let waveReady = false;
  const peaks = normalizeWaveformPeaks(options.waveform);

  const wavesurfer = WaveSurfer.create({
    container,
    media: audio,
    ...(!hlsSrc ? { url: src } : {}),
    ...(peaks?.length ? { peaks } : {}),
    ...(options.duration && options.duration > 0 ? { duration: options.duration } : {}),
    backend: 'MediaElement',
    interact: options.interactive !== false,
    dragToSeek: options.interactive !== false ? { debounceTime: 24 } : false,
    hideScrollbar: true,
    fillParent: true,
    autoScroll: false,
    autoCenter: false,
    minPxPerSec: 0,
    height: 64,
    normalize: true,
    waveColor: initialColors.waveColor,
    progressColor: initialColors.progressColor,
    cursorColor: initialColors.cursorColor,
    cursorWidth: 2,
  });

  const emit = () => {
    options.onStateChange?.({
      ...readState(audio, wavesurfer.getDuration()),
      isReady: waveReady,
    });
  };

  const emitPosition = (currentTime?: number, isScrubbing = false) => {
    const duration = resolveMediaDuration(audio, wavesurfer.getDuration());
    options.onPositionChange?.({
      currentTime: clampMediaTime(typeof currentTime === 'number' ? currentTime : audio.currentTime, duration),
      duration,
      isPlaying: !audio.paused,
      isScrubbing,
    });
  };

  const subscriptions = [
    wavesurfer.on('ready', () => {
      waveReady = true;
      emit();
      emitPosition();
    }),
    wavesurfer.on('play', () => {
      emit();
      emitPosition();
    }),
    wavesurfer.on('pause', () => {
      emit();
      emitPosition();
    }),
    wavesurfer.on('timeupdate', (currentTime) => {
      emit();
      emitPosition(currentTime);
    }),
    wavesurfer.on('audioprocess', (currentTime) => {
      emitPosition(currentTime);
    }),
    wavesurfer.on('seeking', (currentTime) => {
      emit();
      emitPosition(currentTime, true);
    }),
    wavesurfer.on('interaction', (currentTime) => {
      emitPosition(currentTime, true);
    }),
    wavesurfer.on('finish', () => {
      emit();
      emitPosition(0);
    }),
  ];

  const handleVolumeChange = () => emit();
  const handleLoadedMetadata = () => {
    emit();
    emitPosition();
  };
  audio.addEventListener('volumechange', handleVolumeChange);
  audio.addEventListener('loadedmetadata', handleLoadedMetadata);

  const syncWaveSurferColors = () => {
    wavesurfer.setOptions(readWaveSurferColors(container));
  };

  const observerTargets = [
    container.closest('[data-audio-player]'),
    container.closest('[data-mantine-color-scheme]'),
    document.documentElement,
  ].filter((target): target is HTMLElement => Boolean(target));
  const mutationObserver =
    typeof MutationObserver === 'function'
      ? new MutationObserver(() => {
          syncWaveSurferColors();
        })
      : null;
  mutationObserver?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-mantine-color-scheme', 'class', 'style'],
  });
  observerTargets.forEach((target) => {
    if (target === document.documentElement) {
      return;
    }
    mutationObserver?.observe(target, {
      attributes: true,
      attributeFilter: ['data-mantine-color-scheme', 'class', 'style'],
    });
  });

  emit();
  emitPosition();

  return {
    setTime: (time: number) => {
      wavesurfer.setTime(time);
    },
    getDuration: () => resolveMediaDuration(audio, wavesurfer.getDuration()),
    destroy: () => {
      mutationObserver?.disconnect();
      cleanupHls?.();
      audio.removeEventListener('volumechange', handleVolumeChange);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      subscriptions.forEach((unsubscribe) => unsubscribe());
      wavesurfer.destroy();
    },
  };
}
