// @vitest-environment jsdom

import { act } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { VideoPlayer } from './VideoPlayer';

const { mockMountVideoJsPlayer, mockDisposeVideoJsPlayer } = vi.hoisted(() => ({
  mockMountVideoJsPlayer: vi.fn((_videoElement?: HTMLVideoElement) => ({
    dispose: vi.fn(),
    error: vi.fn(),
    one: vi.fn(),
    el: () => null as HTMLElement | null,
  })),
  mockDisposeVideoJsPlayer: vi.fn(),
}));

vi.mock('@/features/media/runtime/videojs-player', async () => {
  const actual = await vi.importActual<typeof import('@/features/media/runtime/videojs-player')>(
    '@/features/media/runtime/videojs-player',
  );

  return {
    ...actual,
    mountVideoJsPlayer: mockMountVideoJsPlayer,
    disposeVideoJsPlayer: mockDisposeVideoJsPlayer,
  };
});

let host: HTMLDivElement | null = null;
let root: Root | null = null;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as MediaQueryList;
}

const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalCancelAnimationFrame = window.cancelAnimationFrame;
window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
  callback(performance.now());
  return 1;
}) as typeof window.requestAnimationFrame;
window.cancelAnimationFrame = ((_: number) => {}) as typeof window.cancelAnimationFrame;

afterAll(() => {
  window.requestAnimationFrame = originalRequestAnimationFrame;
  window.cancelAnimationFrame = originalCancelAnimationFrame;
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  root = null;
  host = null;
  mockMountVideoJsPlayer.mockReset();
  mockMountVideoJsPlayer.mockReturnValue({
    dispose: vi.fn(),
    error: vi.fn(),
    one: vi.fn(),
    el: () => null,
  });
  mockDisposeVideoJsPlayer.mockReset();
});

describe('VideoPlayer', () => {
  const messages = {
    common: {
      states: {
        loading: 'Loading...',
      },
    },
    editorCommon: {
      media: {
        videoPlayer: {
          regionLabel: 'Video player',
          play: 'Play',
          pause: 'Pause',
          controls: {
            audioPlayer: 'Audio Player',
            videoPlayer: 'Video Player',
            videoPlayerLoading: 'Video Player is loading.',
            isLoading: '{target} is loading.',
            close: 'Close',
            closeModalDialog: 'Close Modal Dialog',
            mute: 'Mute',
            unmute: 'Unmute',
            currentTime: 'Current Time',
            duration: 'Duration',
            remainingTime: 'Remaining Time',
            volumeLevel: 'Volume Level',
            progressBar: 'Progress Bar',
            loaded: 'Loaded',
            streamType: 'Stream Type',
            playbackRate: 'Playback Rate',
            fullscreen: 'Fullscreen',
            exitFullscreen: 'Exit Fullscreen',
            skipBackward: 'Skip Backward',
            skipForward: 'Skip Forward',
            skipBackwardSeconds: 'Skip backward {seconds} seconds',
            skipForwardSeconds: 'Skip forward {seconds} seconds',
            seekToLivePlayingLive: 'Seek to live, currently playing live',
            seekToLiveBehindLive: 'Seek to live, currently behind live',
            descriptions: 'Descriptions',
            descriptionsOff: 'descriptions off',
            subtitles: 'Subtitles',
            subtitlesSettings: 'subtitles settings',
            subtitlesOff: 'subtitles off',
            audioTrack: 'Audio Track',
            defaultTrack: 'default',
            chapters: 'Chapters',
            done: 'Done',
            reset: 'Reset',
            live: 'LIVE',
            selected: ', selected',
            opensSubtitlesSettingsDialog: ', opens subtitles settings dialog',
            modalWindow: 'Modal Window',
            modalWindowText: 'This is a modal window.',
            captionSettingsDialog: 'Caption Settings Dialog',
            beginningOfDialogWindow: 'Beginning of dialog window. Escape will cancel and close the window.',
            restoreDefaultSettings: 'restore all settings to the default values',
            endOfDialogWindow: 'End of dialog window.',
            color: 'Color',
            opacity: 'Opacity',
            text: 'Text',
            textBackground: 'Text Background',
            background: 'Background',
            captionAreaBackground: 'Caption Area Background',
            window: 'Window',
            textEdgeStyle: 'Text Edge Style',
            fontFamily: 'Font Family',
            fontSize: 'Font Size',
            none: 'None',
            raised: 'Raised',
            depressed: 'Depressed',
            uniform: 'Uniform',
            dropShadow: 'Drop shadow',
            proportionalSansSerif: 'Proportional Sans-Serif',
            monospaceSansSerif: 'Monospace Sans-Serif',
            proportionalSerif: 'Proportional Serif',
            monospaceSerif: 'Monospace Serif',
            casual: 'Casual',
            script: 'Script',
            smallCaps: 'Small Caps',
            white: 'White',
            black: 'Black',
            red: 'Red',
            green: 'Green',
            blue: 'Blue',
            yellow: 'Yellow',
            magenta: 'Magenta',
            cyan: 'Cyan',
            opaque: 'Opaque',
            semiTransparent: 'Semi-Transparent',
            transparent: 'Transparent',
            playingInPictureInPicture: 'Playing in picture-in-picture',
          },
          processingOverlay: 'Processing video...',
        },
      },
    },
  } as const;

  it('recreates the video element after source changes even if dispose removed the old one', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    mockDisposeVideoJsPlayer.mockImplementation(() => {
      host?.querySelector('video')?.remove();
    });

    await act(async () => {
      root!.render(
        <MantineProvider>
          <NextIntlClientProvider locale="en" messages={messages}>
            <VideoPlayer
              hlsSrc="https://cdn.example.com/master-1.m3u8"
              src="https://cdn.example.com/original.mp4"
              poster="https://cdn.example.com/thumb-1.webp"
            />
          </NextIntlClientProvider>
        </MantineProvider>,
      );
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
    });

    expect(host.querySelector('video')).not.toBeNull();
    expect(mockMountVideoJsPlayer).toHaveBeenCalledTimes(1);

    await act(async () => {
      root!.render(
        <MantineProvider>
          <NextIntlClientProvider locale="en" messages={messages}>
            <VideoPlayer
              hlsSrc="https://cdn.example.com/master-2.m3u8"
              src="https://cdn.example.com/original.mp4"
              poster="https://cdn.example.com/thumb-2.webp"
            />
          </NextIntlClientProvider>
        </MantineProvider>,
      );
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
    });

    expect(host.querySelector('video')).not.toBeNull();
    expect(mockDisposeVideoJsPlayer).toHaveBeenCalledTimes(1);
    expect(mockMountVideoJsPlayer).toHaveBeenCalledTimes(2);
  });

  it('does not remount the player on rerender with unchanged props', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root!.render(
        <MantineProvider>
          <NextIntlClientProvider locale="en" messages={messages}>
            <VideoPlayer
              hlsSrc="https://cdn.example.com/master.m3u8"
              src="https://cdn.example.com/original.mp4"
              poster="https://cdn.example.com/thumb.webp"
            />
          </NextIntlClientProvider>
        </MantineProvider>,
      );
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
    });

    expect(mockMountVideoJsPlayer).toHaveBeenCalledTimes(1);
    expect(mockDisposeVideoJsPlayer).toHaveBeenCalledTimes(0);

    await act(async () => {
      root!.render(
        <MantineProvider>
          <NextIntlClientProvider locale="en" messages={messages}>
            <VideoPlayer
              hlsSrc="https://cdn.example.com/master.m3u8"
              src="https://cdn.example.com/original.mp4"
              poster="https://cdn.example.com/thumb.webp"
            />
          </NextIntlClientProvider>
        </MantineProvider>,
      );
      await Promise.resolve();
    });

    expect(mockMountVideoJsPlayer).toHaveBeenCalledTimes(1);
    expect(mockDisposeVideoJsPlayer).toHaveBeenCalledTimes(0);
  });

  it('mounts a caller action beside the native video controls', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    mockMountVideoJsPlayer.mockImplementationOnce((videoElement) => {
      const playerElement = document.createElement('div');
      const controlBar = document.createElement('div');
      const fullscreen = document.createElement('button');
      controlBar.className = 'vjs-control-bar';
      fullscreen.className = 'vjs-fullscreen-control';
      videoElement?.parentElement?.replaceChild(playerElement, videoElement);
      if (videoElement) {
        playerElement.appendChild(videoElement);
      }
      controlBar.appendChild(fullscreen);
      playerElement.appendChild(controlBar);
      return {
        dispose: vi.fn(),
        error: vi.fn(),
        one: vi.fn(),
        el: () => playerElement,
      };
    });

    await act(async () => {
      root!.render(
        <MantineProvider>
          <NextIntlClientProvider locale="en" messages={messages}>
            <VideoPlayer
              src="https://cdn.example.com/original.mp4"
              action={
                <button type="button" data-player-action>
                  Download
                </button>
              }
            />
          </NextIntlClientProvider>
        </MantineProvider>,
      );
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
    });

    const actionSlot = host.querySelector('[data-video-player-action-slot]');
    expect(actionSlot?.querySelector('[data-player-action]')).not.toBeNull();
    expect(actionSlot?.nextElementSibling?.classList.contains('vjs-fullscreen-control')).toBe(true);
  });
});
