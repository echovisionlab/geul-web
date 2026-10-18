// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AudioPlayer } from './AudioPlayer';

const setMountedWaveTime = vi.fn();
const mountWaveSurferPlayerMock = vi.fn(async (options) => {
  options.onStateChange?.({
    currentTime: 0,
    duration: options.duration || 100,
    isPlaying: false,
    isMuted: false,
    isReady: true,
  });
  options.onPositionChange?.({
    currentTime: 0,
    duration: options.duration || 100,
    isPlaying: false,
    isScrubbing: false,
  });

  return {
    setTime: setMountedWaveTime,
    getDuration: () => options.duration || 100,
    destroy: vi.fn(),
  };
});

vi.mock('@/lib/media/wavesurfer-player', () => ({
  mountWaveSurferPlayer: (...args: Parameters<typeof mountWaveSurferPlayerMock>) => mountWaveSurferPlayerMock(...args),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  setMountedWaveTime.mockClear();
  mountWaveSurferPlayerMock.mockClear();
});

function setMediaDuration(media: HTMLMediaElement, value: number) {
  Object.defineProperty(media, 'duration', {
    configurable: true,
    value,
  });
}

function renderAudioPlayer(props: Partial<React.ComponentProps<typeof AudioPlayer>> = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <NextIntlClientProvider
        locale="ko"
        messages={{
          common: {
            states: {
              loading: '불러오는 중...',
            },
          },
          editorCommon: {
            media: {
              statuses: { failed: '실패' },
              audioPlayer: {
                play: '재생',
                pause: '일시정지',
                mute: '음소거',
                unmute: '음소거 해제',
                playback: '재생',
                seekPlayback: '재생 위치 이동',
                volume: '볼륨',
                download: '다운로드',
                waveform: '파형',
                spectrogram: '스펙트로그램',
                spectrogramAlt: '오디오 스펙트로그램',
              },
            },
          },
        }}
      >
        <DesignSystemProvider locale="ko" forceColorScheme="light">
          <AudioPlayer src="https://cdn.example.com/master.m3u8" duration={100} waveform={[0.1, 0.4, 0.8]} {...props} />
        </DesignSystemProvider>
      </NextIntlClientProvider>,
    );
  });
}

describe('AudioPlayer', () => {
  it('exposes an independently named player and an operable position slider without changing clock text', async () => {
    renderAudioPlayer({ name: 'field-recording.wav' });
    await act(async () => {
      await Promise.resolve();
    });
    const group = document.querySelector('[data-audio-player="true"]');
    expect(group?.getAttribute('role')).toBe('group');
    expect(group?.getAttribute('aria-label')).toBe('field-recording.wav');
    const slider = group?.querySelector<HTMLInputElement>('input[type="range"][aria-label="재생 위치 이동"]');
    expect(slider?.max).toBe('100');
    expect(slider?.value).toBe('0');
    act(() => slider?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(setMountedWaveTime).toHaveBeenLastCalledWith(5);
    expect(slider?.value).toBe('5');
    expect(slider?.getAttribute('aria-valuetext')).toBe('0:05 / 1:40');
    act(() => slider?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    expect(setMountedWaveTime).toHaveBeenLastCalledWith(100);
    act(() => slider?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
    expect(setMountedWaveTime).toHaveBeenLastCalledWith(0);
    expect(group?.querySelector('[data-audio-player-current-time]')?.textContent).toBe('0:00');
  });

  it('disables unavailable seeking and stops exposing a failed source as playable', async () => {
    renderAudioPlayer({ src: '', isReady: false });
    const slider = document.querySelector<HTMLInputElement>('input[type="range"][aria-label="재생 위치 이동"]');
    expect(slider?.disabled).toBe(true);
    act(() => slider?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(setMountedWaveTime).not.toHaveBeenCalled();
  });

  it('disables transport after a native playback error', () => {
    renderAudioPlayer();
    const audio = document.querySelector('audio');
    act(() => audio?.dispatchEvent(new Event('error')));
    expect(document.querySelector<HTMLButtonElement>('[data-audio-player-toggle]')?.disabled).toBe(true);
    const status = document.querySelector('[role="status"]');
    expect(status?.textContent).toBe('실패');
    expect(status?.className).toContain('visuallyHidden');
    expect(document.querySelector('[data-audio-player]')?.getAttribute('aria-describedby')).toBe(status?.id);
    expect(
      document
        .querySelector<HTMLInputElement>('input[type="range"][aria-label="재생 위치 이동"]')
        ?.getAttribute('aria-describedby'),
    ).toBe(status?.id);
    expect(document.querySelector<HTMLInputElement>('input[type="range"][aria-label="재생 위치 이동"]')?.disabled).toBe(
      true,
    );
    act(() => audio?.dispatchEvent(new Event('loadedmetadata')));
    expect(status?.textContent).toBe('');
    expect(document.querySelector('[data-audio-player]')?.hasAttribute('aria-describedby')).toBe(false);
    expect(document.querySelector<HTMLButtonElement>('[data-audio-player-toggle]')?.disabled).toBe(false);
  });

  it('updates the playback progress from the shared audio clock', () => {
    renderAudioPlayer();

    const player = document.querySelector('[data-audio-player="true"]') as HTMLDivElement | null;
    const currentTime = document.querySelector('[data-audio-player-current-time]') as HTMLSpanElement | null;
    const audio = document.querySelector('audio.audio-player__media') as HTMLAudioElement | null;

    expect(player).not.toBeNull();
    expect(currentTime?.textContent).toBe('0:00');
    expect(audio).not.toBeNull();

    act(() => {
      if (!audio) {
        return;
      }
      setMediaDuration(audio, 100);
      audio.currentTime = 42;
      audio.dispatchEvent(new Event('loadedmetadata'));
      audio.dispatchEvent(new Event('timeupdate'));
    });

    expect(currentTime?.textContent).toBe('0:42');
  });

  it('uses WaveSurfer readiness even when no waveform sidecar is provided', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <NextIntlClientProvider
          locale="ko"
          messages={{
            editorCommon: {
              media: {
                audioPlayer: {
                  play: '재생',
                  pause: '일시정지',
                  mute: '음소거',
                  unmute: '음소거 해제',
                  playback: '재생',
                  seekPlayback: '재생 위치 이동',
                  volume: '볼륨',
                  download: '다운로드',
                  waveform: '파형',
                  spectrogram: '스펙트로그램',
                  spectrogramAlt: '오디오 스펙트로그램',
                },
              },
            },
          }}
        >
          <DesignSystemProvider locale="ko" forceColorScheme="light">
            <AudioPlayer src="https://cdn.example.com/master.m3u8" duration={100} />
          </DesignSystemProvider>
        </NextIntlClientProvider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(document.querySelector('[data-audio-player-wave-loading="true"]')).toBeNull();
    expect(
      document.querySelector('[data-audio-player-wave="true"]')?.getAttribute('data-audio-player-wave-ready'),
    ).toBe('true');
  });

  it('keeps the waveform loading spinner until WaveSurfer is ready', async () => {
    mountWaveSurferPlayerMock.mockImplementationOnce((options) => {
      options.onStateChange?.({
        currentTime: 0,
        duration: options.duration || 100,
        isPlaying: false,
        isMuted: false,
        isReady: false,
      });

      return new Promise(() => undefined);
    });

    renderAudioPlayer();

    await act(async () => {
      await Promise.resolve();
    });

    expect(document.querySelector('[data-audio-player-wave-loading="true"]')).not.toBeNull();

    const audio = document.querySelector('audio.audio-player__media') as HTMLAudioElement | null;
    expect(audio).not.toBeNull();

    act(() => {
      if (!audio) {
        return;
      }
      setMediaDuration(audio, 100);
      audio.currentTime = 42;
      audio.dispatchEvent(new Event('loadedmetadata'));
      audio.dispatchEvent(new Event('timeupdate'));
    });

    expect(document.querySelector('[data-audio-player-wave-loading="true"]')).not.toBeNull();
    expect(
      document.querySelector('[data-audio-player-wave="true"]')?.getAttribute('data-audio-player-wave-ready'),
    ).toBe('false');
  });
});
