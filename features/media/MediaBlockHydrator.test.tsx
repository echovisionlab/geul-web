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
    expect(player?.style.getPropertyValue('--audio-playback-progress')).toBe('42%');
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
});
