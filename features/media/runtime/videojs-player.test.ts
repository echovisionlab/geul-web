// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { disposeVideoJsPlayer, mountVideoJsPlayer, resolveVideoPlaybackSource } from './videojs-player';

const { mockVideoJs, mockGetPlayer } = vi.hoisted(() => ({
  mockVideoJs: vi.fn(),
  mockGetPlayer: vi.fn(),
}));

vi.mock('video.js', () => {
  const videojs = Object.assign((...args: unknown[]) => mockVideoJs(...args), {
    getPlayer: mockGetPlayer,
    hook: vi.fn(),
  });
  return { default: videojs };
});

afterEach(() => {
  mockVideoJs.mockReset();
  mockGetPlayer.mockReset();
  document.body.innerHTML = '';
});

describe('videojs-player', () => {
  it('prefers HLS for playback when both hls and original URLs exist', () => {
    expect(
      resolveVideoPlaybackSource({
        hlsSrc: 'https://cdn.example.com/master.m3u8',
        src: 'https://cdn.example.com/original.mp4',
      }),
    ).toEqual({
      src: 'https://cdn.example.com/master.m3u8',
      type: 'application/x-mpegURL',
    });
  });

  it('mounts video.js with the resolved playback source', () => {
    const player = {
      addClass: vi.fn(),
      width: vi.fn(),
      el: vi.fn(() => document.createElement('div')),
      on: vi.fn(),
      one: vi.fn(),
      error: vi.fn(),
      dispose: vi.fn(),
    };
    const existing = {
      dispose: vi.fn(),
    };
    const video = document.createElement('video');
    document.body.appendChild(video);

    mockGetPlayer.mockReturnValue(existing);
    mockVideoJs.mockReturnValue(player);

    const mounted = mountVideoJsPlayer(video, {
      hlsSrc: 'https://cdn.example.com/master.m3u8',
      src: 'https://cdn.example.com/original.mp4',
      poster: 'https://cdn.example.com/thumb.webp',
    });

    expect(existing.dispose).toHaveBeenCalled();
    expect(mockVideoJs).toHaveBeenCalledWith(
      video,
      expect.objectContaining({
        fluid: true,
        poster: 'https://cdn.example.com/thumb.webp',
        sources: [
          {
            src: 'https://cdn.example.com/master.m3u8',
            type: 'application/x-mpegURL',
          },
        ],
      }),
    );
    expect(player.width).toHaveBeenCalledWith('100%');
    expect(player.addClass).toHaveBeenCalledWith('geul-video-js');
    expect(video.classList.contains('video-js')).toBe(true);
    expect(video.getAttribute('playsinline')).toBe('true');
    expect(mounted).toBe(player);
  });

  it('clears the built-in video.js error state when the caller handles playback recovery', () => {
    let onError: (() => void) | undefined;
    const player = {
      addClass: vi.fn(),
      width: vi.fn(),
      el: vi.fn(() => document.createElement('div')),
      on: vi.fn((event: string, callback: () => void) => {
        if (event === 'error') {
          onError = callback;
        }
      }),
      one: vi.fn(),
      error: vi.fn(),
      dispose: vi.fn(),
    };
    const video = document.createElement('video');
    document.body.appendChild(video);

    mockGetPlayer.mockReturnValue(undefined);
    mockVideoJs.mockReturnValue(player);

    mountVideoJsPlayer(video, {
      hlsSrc: 'https://cdn.example.com/master.m3u8',
      onError: () => true,
    });

    expect(onError).toBeTypeOf('function');
    onError?.();

    expect(player.error).toHaveBeenCalledWith(null);
  });

  it('registers a beforeerror hook that suppresses handled errors before video.js logs them', async () => {
    const { default: videojs } = await import('video.js');
    const hook = vi.mocked(videojs.hook);
    const video = document.createElement('video');
    const player = {
      addClass: vi.fn(),
      width: vi.fn(),
      tag: video,
      el: vi.fn(() => {
        return document.createElement('div');
      }),
      on: vi.fn(),
      one: vi.fn(),
      error: vi.fn(),
      dispose: vi.fn(),
    };
    document.body.appendChild(video);

    mockGetPlayer.mockReturnValue(undefined);
    mockVideoJs.mockReturnValue(player);

    mountVideoJsPlayer(video, {
      hlsSrc: 'https://cdn.example.com/master.m3u8',
      onBeforeError: () => true,
    });

    const beforeErrorRegistration = hook.mock.calls.find(([type]) => type === 'beforeerror');
    expect(beforeErrorRegistration).toBeTruthy();
    const beforeError = beforeErrorRegistration?.[1] as
      ((player: { el: () => HTMLDivElement }, err: { code: number }) => { code: number } | null) | undefined;

    expect(beforeError?.(player, { code: 4 })).toBeNull();
  });

  it('does not re-run playback recovery for a recently suppressed beforeerror', async () => {
    const { default: videojs } = await import('video.js');
    const hook = vi.mocked(videojs.hook);
    let onError: (() => void) | undefined;
    const video = document.createElement('video');
    const player = {
      addClass: vi.fn(),
      width: vi.fn(),
      tag: video,
      el: vi.fn(() => document.createElement('div')),
      on: vi.fn((event: string, callback: () => void) => {
        if (event === 'error') {
          onError = callback;
        }
      }),
      one: vi.fn(),
      error: vi.fn(),
      dispose: vi.fn(),
    };
    const recover = vi.fn(() => true);
    document.body.appendChild(video);

    mockGetPlayer.mockReturnValue(undefined);
    mockVideoJs.mockReturnValue(player);

    mountVideoJsPlayer(video, {
      hlsSrc: 'https://cdn.example.com/master.m3u8',
      onBeforeError: () => true,
      onError: recover,
    });

    const beforeErrorRegistration = hook.mock.calls.find(([type]) => type === 'beforeerror');
    expect(beforeErrorRegistration).toBeTruthy();
    const beforeError = beforeErrorRegistration?.[1] as
      ((player: { el: () => HTMLDivElement }, err: { code: number }) => { code: number } | null) | undefined;

    expect(beforeError?.(player, { code: 4 })).toBeNull();
    onError?.();

    expect(recover).not.toHaveBeenCalled();
    expect(player.error).toHaveBeenCalledWith(null);
  });

  it('suppresses media source errors caused by disposing a player without running recovery', async () => {
    const { default: videojs } = await import('video.js');
    const hook = vi.mocked(videojs.hook);
    const video = document.createElement('video');
    const recover = vi.fn(() => true);
    const player = {
      addClass: vi.fn(),
      width: vi.fn(),
      tag: video,
      el: vi.fn(() => document.createElement('div')),
      on: vi.fn(),
      one: vi.fn(),
      error: vi.fn(),
      dispose: vi.fn(),
    };
    document.body.appendChild(video);

    mockGetPlayer.mockReturnValue(undefined);
    mockVideoJs.mockReturnValue(player);

    const mounted = mountVideoJsPlayer(video, {
      hlsSrc: 'https://cdn.example.com/master.m3u8',
      onBeforeError: recover,
    });

    const beforeErrorRegistration = hook.mock.calls.find(([type]) => type === 'beforeerror');
    expect(beforeErrorRegistration).toBeTruthy();
    const beforeError = beforeErrorRegistration?.[1] as
      ((player: { el: () => HTMLDivElement }, err: { code: number }) => { code: number } | null) | undefined;

    disposeVideoJsPlayer(mounted as never);

    expect(beforeError?.(player, { code: 4 })).toBeNull();
    expect(recover).not.toHaveBeenCalled();
  });

  it('does not mount video.js for detached elements', () => {
    const video = document.createElement('video');

    const mounted = mountVideoJsPlayer(video, {
      hlsSrc: 'https://cdn.example.com/master.m3u8',
    });

    expect(mounted).toBeNull();
    expect(mockVideoJs).not.toHaveBeenCalled();
  });

  it('swallows abort errors while disposing a player', () => {
    const player = {
      dispose: vi.fn(() => {
        throw new DOMException(
          "The fetching process for the media resource was aborted by the user agent at the user's request.",
          'AbortError',
        );
      }),
    };

    expect(() => {
      disposeVideoJsPlayer(player as never);
    }).not.toThrow();
  });
});
