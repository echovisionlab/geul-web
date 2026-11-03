// @vitest-environment jsdom
import { act, render, screen, within, waitFor } from '@/test/render';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/core/Button';
import enMessages from '@/messages/en.json';
import { VideoPlayer } from './VideoPlayer';

const runtime = vi.hoisted(() => ({
  mountVideoJsPlayer: vi.fn(),
  disposeVideoJsPlayer: vi.fn(),
  load: vi.fn(),
}));
vi.mock('./runtime/videojs-loader', () => ({ loadVideoJsRuntime: runtime.load }));
beforeEach(() => {
  runtime.mountVideoJsPlayer.mockImplementation(() => ({ el: () => null }));
  runtime.load.mockResolvedValue(runtime);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const messages = {
  ...enMessages,
  common: {
    ...enMessages.common,
    states: {
      ...enMessages.common.states,
      loading: 'Loading...',
    },
  },
  editorCommon: {
    ...enMessages.editorCommon,
    media: {
      ...enMessages.editorCommon.media,
      videoEditor: { ...enMessages.editorCommon.media.videoEditor, processingOverlay: 'Video is processing...' },
      videoPlayer: {
        ...enMessages.editorCommon.media.videoPlayer,
        regionLabel: 'Video player',
        play: 'Play',
        pause: 'Pause',
        controls: {
          ...enMessages.editorCommon.media.videoPlayer.controls,
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
      },
    },
  },
} as const satisfies typeof enMessages;

function player(props: Parameters<typeof VideoPlayer>[0] = {}) {
  return <VideoPlayer {...props} />;
}
function mountedVideo() {
  return runtime.mountVideoJsPlayer.mock.lastCall?.[0] as HTMLVideoElement;
}
describe('VideoPlayer preparation and playback handoff', () => {
  it('shows a bounded shared loader until the runtime mounts and resets it for a new source', async () => {
    const pending = deferred<typeof runtime>();
    runtime.load.mockReturnValueOnce(pending.promise);
    const view = render(player({ src: '/first.mp4' }), { messages });
    expect(screen.getByRole('status')).toHaveTextContent('Video Player is loading.');
    expect(runtime.mountVideoJsPlayer).not.toHaveBeenCalled();
    await act(async () => pending.resolve(runtime));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(mountedVideo().isConnected).toBe(true);
    const next = deferred<typeof runtime>();
    runtime.load.mockReturnValueOnce(next.promise);
    view.rerender(player({ src: '/second.mp4' }));
    expect(screen.getByRole('status')).toHaveTextContent('Video Player is loading.');
    await act(async () => next.resolve(runtime));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('recreates the video element after source changes even if disposal removed the old one', async () => {
    runtime.disposeVideoJsPlayer.mockImplementationOnce(() => mountedVideo().remove());
    const view = render(player({ src: '/first.mp4' }), { messages });
    await waitFor(() => expect(runtime.mountVideoJsPlayer).toHaveBeenCalledOnce());
    const first = mountedVideo();
    view.rerender(player({ src: '/second.mp4' }));
    await waitFor(() => expect(runtime.mountVideoJsPlayer).toHaveBeenCalledTimes(2));
    expect(first.isConnected).toBe(false);
    expect(mountedVideo()).not.toBe(first);
    expect(mountedVideo().isConnected).toBe(true);
    expect(runtime.disposeVideoJsPlayer).toHaveBeenCalledOnce();
    expect(runtime.mountVideoJsPlayer).toHaveBeenCalledTimes(2);
  });
  it('does not remount the player on rerender with unchanged props', async () => {
    const view = render(player({ src: '/original.mp4' }), { messages });
    await waitFor(() => expect(runtime.mountVideoJsPlayer).toHaveBeenCalledOnce());
    view.rerender(player({ src: '/original.mp4' }));
    expect(runtime.mountVideoJsPlayer).toHaveBeenCalledOnce();
    expect(runtime.disposeVideoJsPlayer).not.toHaveBeenCalled();
  });
  it('mounts a caller action beside the native video controls', async () => {
    let fullscreen!: HTMLButtonElement;
    // The vendor boundary owns this DOM; the fixture recreates its control-bar insertion point.
    /* eslint-disable testing-library/no-node-access */
    runtime.mountVideoJsPlayer.mockImplementationOnce((video: HTMLVideoElement) => {
      const controlBar = document.createElement('div');
      controlBar.className = 'vjs-control-bar';
      fullscreen = document.createElement('button');
      fullscreen.className = 'vjs-fullscreen-control';
      fullscreen.setAttribute('aria-label', 'Fullscreen');
      controlBar.append(fullscreen);
      video.parentElement!.append(controlBar);
      return { el: () => video.parentElement };
    });
    render(player({ src: '/original.mp4', action: <Button>Download</Button> }), { messages });
    const action = await screen.findByRole('button', { name: 'Download' });
    expect(within(screen.getByRole('group', { name: 'Video player' })).getByRole('button', { name: 'Download' })).toBe(
      action,
    );
    expect(action.parentElement?.nextElementSibling).toBe(fullscreen);
    /* eslint-enable testing-library/no-node-access */
  });
  it('does not request the runtime without a ready playable source or replace processing progress', () => {
    const view = render(player(), { messages });
    view.rerender(player({ src: '/original.mp4', isReady: false, isProcessing: true }));
    expect(screen.getByRole('status')).toHaveTextContent('Video is processing...');
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    view.rerender(player({ src: 'undefined' }));
    expect(runtime.load).not.toHaveBeenCalled();
  });
  it('does not mount after unmount while the runtime is loading', async () => {
    const pending = deferred<typeof runtime>();
    runtime.load.mockReturnValueOnce(pending.promise);
    const view = render(player({ src: '/original.mp4' }), { messages });
    expect(screen.getByRole('status')).toBeInTheDocument();
    view.unmount();
    await act(async () => pending.resolve(runtime));
    expect(runtime.mountVideoJsPlayer).not.toHaveBeenCalled();
  });
  it('mounts only the latest source when props change during a shared load', async () => {
    const pending = deferred<typeof runtime>();
    runtime.load.mockReturnValue(pending.promise);
    const view = render(player({ src: '/first.mp4' }), { messages });
    view.rerender(player({ src: '/second.mp4' }));
    await act(async () => pending.resolve(runtime));
    expect(runtime.mountVideoJsPlayer).toHaveBeenCalledOnce();
    expect(runtime.mountVideoJsPlayer).toHaveBeenCalledWith(
      expect.any(HTMLVideoElement),
      expect.objectContaining({ src: '/second.mp4' }),
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it.each(['import', 'mount'] as const)(
    'keeps native playback on %s failure and retries on a later source',
    async (failure) => {
      let frame!: FrameRequestCallback;
      if (failure === 'import') {
        runtime.load.mockRejectedValueOnce(new Error('chunk unavailable'));
      } else {
        runtime.mountVideoJsPlayer.mockImplementationOnce(() => {
          throw new Error('Player unavailable');
        });
        vi.mocked(window.requestAnimationFrame).mockImplementationOnce((callback) => {
          frame = callback;
          return 1;
        });
      }
      const view = render(player({ hlsSrc: '/master.m3u8', src: '/original.mp4', name: 'session.mp4' }), { messages });
      if (failure === 'mount') {
        await waitFor(() => expect(frame).toBeTypeOf('function'));
        act(() => frame(0));
      }
      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
      const native = screen
        .getAllByLabelText('session.mp4')
        .find((element) => element instanceof HTMLVideoElement) as HTMLVideoElement;
      expect(native).toHaveAttribute('src', '/original.mp4');
      expect(native.controls).toBe(true);
      expect(screen.getByRole('group', { name: 'session.mp4' })).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      view.rerender(player({ src: '/next.mp4' }));
      await waitFor(() => expect(runtime.mountVideoJsPlayer).toHaveBeenCalledTimes(failure === 'mount' ? 2 : 1));
    },
  );
});
