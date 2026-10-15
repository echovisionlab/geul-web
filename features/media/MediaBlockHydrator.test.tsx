// @vitest-environment jsdom

import { act, useEffect, useRef } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAudioViewModel } from '@/lib/media/audio-view-model';
import { buildAudioMediaDom } from '@/lib/media/dom-builders';
import enMessages from '@/messages/en.json';
import { MediaBlockHydrator } from './MediaBlockHydrator';

const { mockMountVideoJsPlayer, mockDisposeVideoJsPlayer } = vi.hoisted(() => ({
  mockMountVideoJsPlayer: vi.fn(() => ({ dispose: vi.fn() })),
  mockDisposeVideoJsPlayer: vi.fn(),
}));
const { mockFetchWaveformData } = vi.hoisted(() => ({
  mockFetchWaveformData: vi.fn(async () => [0.1, 0.4, 0.8]),
}));

vi.mock('@/features/media/runtime/videojs-player', () => ({
  mountVideoJsPlayer: mockMountVideoJsPlayer,
  disposeVideoJsPlayer: mockDisposeVideoJsPlayer,
}));
vi.mock('@/lib/media/waveform-sidecar', () => ({
  fetchWaveformData: mockFetchWaveformData,
}));

const mockMountedWaveSurfer = {
  setTime: vi.fn(),
  getDuration: vi.fn(() => 100),
  destroy: vi.fn(),
};

let lastMountOptions: {
  onPositionChange?: (state: {
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    isScrubbing: boolean;
  }) => void;
} | null = null;

vi.mock('@/lib/media/wavesurfer-player', () => ({
  mountWaveSurferPlayer: vi.fn(async (options) => {
    lastMountOptions = options;
    return mockMountedWaveSurfer;
  }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

window.requestAnimationFrame = (callback: FrameRequestCallback) =>
  window.setTimeout(() => callback(performance.now()), 0);

window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);

const mockLoadVideoJsRuntime = vi.hoisted(() => vi.fn());
vi.mock('@/features/media/runtime/videojs-loader', () => ({
  loadVideoJsRuntime: mockLoadVideoJsRuntime,
}));

mockLoadVideoJsRuntime.mockImplementation(async () => ({
  mountVideoJsPlayer: mockMountVideoJsPlayer,
  disposeVideoJsPlayer: mockDisposeVideoJsPlayer,
}));

let host: HTMLDivElement | null = null;
let content: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  root = null;
  content = null;
  host = null;
  mockMountedWaveSurfer.setTime.mockClear();
  mockMountedWaveSurfer.getDuration.mockClear();
  mockMountedWaveSurfer.destroy.mockClear();
  mockMountVideoJsPlayer.mockReset();
  mockMountVideoJsPlayer.mockReturnValue({ dispose: vi.fn() });
  mockDisposeVideoJsPlayer.mockReset();
  mockLoadVideoJsRuntime.mockReset();
  mockLoadVideoJsRuntime.mockImplementation(async () => ({
    mountVideoJsPlayer: mockMountVideoJsPlayer,
    disposeVideoJsPlayer: mockDisposeVideoJsPlayer,
  }));
  lastMountOptions = null;
  mockFetchWaveformData.mockReset();
  mockFetchWaveformData.mockResolvedValue([0.1, 0.4, 0.8]);
});

function renderAudioMarkup(container: HTMLElement) {
  const dom = buildAudioMediaDom(
    resolveAudioViewModel({
      fileId: 'audio-1',
      originalUrl: 'https://cdn.example.com/original.wav',
      hlsUrl: 'https://cdn.example.com/master.m3u8',
      waveformUrl: 'https://cdn.example.com/waveform.json',
      spectrogramUrl: 'https://cdn.example.com/spectrogram.png',
      duration: '100',
      processingStatus: 'completed',
    }),
    'audio-block-html audio-block',
  );
  container.replaceChildren(dom);
}

function renderVideoMarkup(container: HTMLElement) {
  container.innerHTML = `
    <div
      class="video-block"
      data-media-kind="video"
      data-file-id="video-1"
      data-hls-src="https://cdn.example.com/master.m3u8"
      data-original-url="https://cdn.example.com/original.mp4"
      data-poster-url="https://cdn.example.com/thumb.webp"
    >
      <div class="video-player-container">
        <video data-file-id="video-1"></video>
      </div>
    </div>
  `;
}

function AudioHydrationHarness() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      renderAudioMarkup(containerRef.current);
      content = containerRef.current;
    }
  }, []);

  return (
    <>
      <div ref={containerRef} />
      <MediaBlockHydrator containerRef={containerRef} />
    </>
  );
}

function VideoHydrationHarness() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      renderVideoMarkup(containerRef.current);
      content = containerRef.current;
    }
  }, []);

  return (
    <>
      <div ref={containerRef} />
      <MediaBlockHydrator containerRef={containerRef} />
    </>
  );
}

describe('MediaBlockHydrator', () => {
  it('keeps the public HTML player independently named and supports seek values, keyboard input and native error state', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <AudioHydrationHarness />
        </NextIntlClientProvider>,
      );
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    await vi.waitFor(() => expect(lastMountOptions).not.toBeNull());
    const player = content?.querySelector('[data-audio-player]');
    const frame = player?.querySelector<HTMLElement>('[data-audio-player-track]');
    const position = frame?.querySelector<HTMLInputElement>('input[type="range"][data-audio-player-seek]');
    expect(player?.getAttribute('role')).toBe('group');
    expect(player?.getAttribute('aria-label')).toBeTruthy();
    expect(frame?.hasAttribute('role')).toBe(false);
    expect(frame?.hasAttribute('tabindex')).toBe(false);
    expect(frame?.querySelectorAll('input[data-audio-player-seek]')).toHaveLength(1);
    expect(position?.getAttribute('aria-label')).toBe(enMessages.editorCommon.media.audioPlayer.seekPlayback);
    expect(position?.max).toBe('100');
    act(() => position?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(mockMountedWaveSurfer.setTime).toHaveBeenLastCalledWith(5);
    expect(position?.value).toBe('5');
    expect(position?.getAttribute('aria-valuetext')).toBe('0:05 / 1:40');
    act(() => position?.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true })));
    expect(mockMountedWaveSurfer.setTime).toHaveBeenLastCalledWith(15);
    act(() => position?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    expect(mockMountedWaveSurfer.setTime).toHaveBeenLastCalledWith(100);
    act(() => {
      position!.value = '40';
      position?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(mockMountedWaveSurfer.setTime).toHaveBeenLastCalledWith(40);
    const audio = content?.querySelector('audio');
    act(() => audio?.dispatchEvent(new Event('error')));
    const status = content?.querySelector('[data-audio-player-status]');
    expect(status?.textContent).toBe(enMessages.editorCommon.media.statuses.failed);
    expect(status?.className).toContain('visuallyHidden');
    expect(player?.getAttribute('aria-describedby')).toBe(status?.id);
    expect(position?.getAttribute('aria-describedby')).toBe(status?.id);
    expect(position?.disabled).toBe(true);
    expect(player?.querySelector<HTMLButtonElement>('[data-audio-player-toggle]')?.disabled).toBe(true);
    act(() => audio?.dispatchEvent(new Event('loadedmetadata')));
    expect(status?.textContent).toBe('');
    expect(player?.hasAttribute('aria-describedby')).toBe(false);
    expect(position?.disabled).toBe(false);
  });

  it('moves persisted role="slider" timeline semantics onto one Core native range', async () => {
    const legacy = document.createElement('div');
    legacy.className = 'audio-block';
    legacy.setAttribute('data-duration', '60');
    legacy.innerHTML =
      '<div class="audio-player" data-audio-player="true"><audio data-file-id="legacy" src="https://cdn.example.com/a.mp3"></audio>' +
      '<div class="audio-player__track" data-audio-player-track="true" role="slider" tabindex="0" aria-valuenow="0" aria-label="Seek">' +
      '<span data-audio-player-track-fill="true"></span><span data-audio-player-track-thumb="true"></span></div>' +
      '<button data-audio-player-toggle="true" aria-label="Play"></button></div>';
    host = document.createElement('div');
    document.body.appendChild(host);
    const containerRef = { current: legacy };
    host.appendChild(legacy);
    root = createRoot(document.createElement('div'));
    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MediaBlockHydrator containerRef={containerRef} contentKey="legacy" />
        </NextIntlClientProvider>,
      );
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    });
    const track = legacy.querySelector<HTMLElement>('[data-audio-player-track]');
    await vi.waitFor(() => expect(track?.querySelector('input[data-audio-player-seek]')).not.toBeNull());
    expect(track?.hasAttribute('role')).toBe(false);
    expect(track?.hasAttribute('tabindex')).toBe(false);
    expect(track?.hasAttribute('aria-valuenow')).toBe(false);
    const range = track?.querySelector<HTMLInputElement>('input[data-audio-player-seek]');
    expect(range?.type).toBe('range');
    expect(range?.getAttribute('aria-label')).toBe(enMessages.editorCommon.media.audioPlayer.seekPlayback);
    expect(range?.getAttribute('aria-valuetext')).toBe('0:00 / 1:00');
  });

  it('updates public audio progress from the shared waveform position stream', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <AudioHydrationHarness />
        </NextIntlClientProvider>,
      );
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    await vi.waitFor(() => {
      expect(lastMountOptions).not.toBeNull();
    });
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    });

    const contentNode = content as HTMLDivElement;
    const player = contentNode.querySelector('[data-audio-player="true"]') as HTMLDivElement | null;
    const currentTime = contentNode.querySelector('[data-audio-player-current-time]') as HTMLSpanElement | null;

    expect(player).not.toBeNull();
    expect(currentTime?.textContent).toBe('0:00');
    expect(contentNode.querySelector('[data-audio-player-view-toggle]')).toBeNull();
    expect(contentNode.querySelector('[data-audio-player-spectrogram-frame]')).toBeNull();

    act(() => {
      lastMountOptions?.onPositionChange?.({
        currentTime: 42,
        duration: 100,
        isPlaying: false,
        isScrubbing: false,
      });
    });

    expect(currentTime?.textContent).toBe('0:42');
    expect(player?.getAttribute('data-audio-player-ready')).toBe('true');
    expect(player?.getAttribute('data-audio-player-playing')).toBe('false');
  });

  it('mounts and disposes video players through the shared video.js helper', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <VideoHydrationHarness />
        </NextIntlClientProvider>,
      );
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    await vi.waitFor(() => {
      expect(mockMountVideoJsPlayer).toHaveBeenCalledWith(
        expect.any(HTMLVideoElement),
        expect.objectContaining({
          hlsSrc: 'https://cdn.example.com/master.m3u8',
          src: 'https://cdn.example.com/original.mp4',
          poster: 'https://cdn.example.com/thumb.webp',
        }),
      );
    });

    act(() => {
      root?.unmount();
    });

    expect(mockDisposeVideoJsPlayer).toHaveBeenCalled();
  });

  it('does not dispose an existing video player when the raw video node disappears during mount churn', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <VideoHydrationHarness />
        </NextIntlClientProvider>,
      );
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    await vi.waitFor(() => {
      expect(mockMountVideoJsPlayer).toHaveBeenCalledTimes(1);
    });

    const videoBlock = content?.querySelector('.video-block') as HTMLDivElement | null;
    const playerContainer = content?.querySelector('.video-player-container') as HTMLDivElement | null;
    expect(videoBlock).not.toBeNull();
    expect(playerContainer).not.toBeNull();

    await act(async () => {
      playerContainer?.replaceChildren();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(mockDisposeVideoJsPlayer).not.toHaveBeenCalled();

    act(() => {
      root?.unmount();
    });

    expect(mockDisposeVideoJsPlayer).toHaveBeenCalledTimes(1);
  });
  async function renderVideoHarness() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <VideoHydrationHarness />
        </NextIntlClientProvider>,
      );
    });
    await vi.waitFor(() => expect(mockLoadVideoJsRuntime).toHaveBeenCalled());
  }

  it('cancels video hydration when unmounted during the runtime load', async () => {
    let resolveRuntime!: (runtime: unknown) => void;
    mockLoadVideoJsRuntime.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRuntime = resolve;
      }),
    );
    await renderVideoHarness();
    act(() => {
      root!.unmount();
      root = null;
    });
    await act(async () => {
      resolveRuntime({ mountVideoJsPlayer: mockMountVideoJsPlayer, disposeVideoJsPlayer: mockDisposeVideoJsPlayer });
      await Promise.resolve();
    });
    expect(mockMountVideoJsPlayer).not.toHaveBeenCalled();
  });

  it('cancels pending hydration when a video block is removed', async () => {
    let resolveRuntime!: (runtime: unknown) => void;
    mockLoadVideoJsRuntime.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRuntime = resolve;
      }),
    );
    await renderVideoHarness();
    await act(async () => {
      content?.replaceChildren();
      await new Promise((resolve) => window.setTimeout(resolve, 20));
      resolveRuntime({ mountVideoJsPlayer: mockMountVideoJsPlayer, disposeVideoJsPlayer: mockDisposeVideoJsPlayer });
    });
    expect(mockMountVideoJsPlayer).not.toHaveBeenCalled();
  });

  it('hydrates only the latest source when block attributes change during loading', async () => {
    let resolveRuntime!: (runtime: unknown) => void;
    mockLoadVideoJsRuntime.mockReturnValue(
      new Promise((resolve) => {
        resolveRuntime = resolve;
      }),
    );
    await renderVideoHarness();
    await act(async () => {
      content?.querySelector('.video-block')?.setAttribute('data-hls-src', '/next.m3u8');
      await new Promise((resolve) => window.setTimeout(resolve, 20));
      resolveRuntime({ mountVideoJsPlayer: mockMountVideoJsPlayer, disposeVideoJsPlayer: mockDisposeVideoJsPlayer });
    });
    expect(mockMountVideoJsPlayer).toHaveBeenCalledTimes(1);
    expect(mockMountVideoJsPlayer).toHaveBeenCalledWith(
      expect.any(HTMLVideoElement),
      expect.objectContaining({ hlsSrc: '/next.m3u8' }),
    );
  });

  it('keeps static native controls if the runtime import fails', async () => {
    mockLoadVideoJsRuntime.mockRejectedValueOnce(new Error('chunk unavailable'));
    await renderVideoHarness();
    await vi.waitFor(() => expect(content?.querySelector('video')?.controls).toBe(true));
    expect(content?.querySelector('video')?.getAttribute('src')).toBe('https://cdn.example.com/original.mp4');
    expect(mockMountVideoJsPlayer).not.toHaveBeenCalled();
  });
});
