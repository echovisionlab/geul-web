import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientMediaUnavailableError } from './contracts';
import { processClientVideo, selectVideoRenditions } from './video-processing';

const runtime = vi.hoisted(() => ({
  encodeVideo: true,
  encodeAudio: true,
  hasAudio: true,
  discarded: false,
  finalization: undefined as Promise<void> | undefined,
  conversionOptions: undefined as Record<string, unknown> | undefined,
  videoConfigs: [] as object[],
  audioConfigs: [] as object[],
  dispose: vi.fn(),
  closeSample: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock('./browser-runtime', () => ({ ensureAudioCodecs: vi.fn() }));
vi.mock('./video-thumbnail', () => ({
  encodeVideoThumbnail: async () => new Blob(['thumbnail'], { type: 'image/webp' }),
}));
vi.mock('./video-hls', () => ({ normalizeVideoTransportStream: (buffer: ArrayBuffer) => new Uint8Array(buffer) }));
vi.mock('mediabunny', () => {
  const track = {
    canDecode: async () => true,
    hasHighDynamicRange: async () => false,
    getDisplayWidth: async () => 1280,
    getDisplayHeight: async () => 720,
  };
  return {
    ALL_FORMATS: [],
    BlobSource: class {},
    Input: class {
      canRead = async () => true;
      getPrimaryVideoTrack = async () => track;
      getPrimaryAudioTrack = async () => (runtime.hasAudio ? track : null);
      getFirstTimestamp = async () => 0;
      computeDuration = async () => 15;
      dispose = runtime.dispose;
    },
    Quality: class {
      constructor(public options: object) {}
    },
    OutputTrackGroup: class {},
    HlsOutputFormat: class {},
    MpegTsOutputFormat: class {},
    PathedTarget: class {
      constructor(
        public path: string,
        public getTarget: (request: object) => { options: { onFinalize: (buffer: ArrayBuffer) => Promise<void> } },
      ) {}
    },
    BufferTarget: class {
      constructor(public options: object) {}
    },
    Output: class {
      state = 'pending';
      tracks: object[] = [];
      constructor(
        public options: {
          target: {
            getTarget: (request: object) => { options: { onFinalize: (buffer: ArrayBuffer) => Promise<void> } };
          };
        },
      ) {}
      cancel = async () => {
        this.state = 'canceled';
        runtime.cancel();
      };
    },
    canEncodeVideo: async (_: string, config: object) => {
      runtime.videoConfigs.push(config);
      return runtime.encodeVideo;
    },
    canEncodeAudio: async (_: string, config: object) => {
      runtime.audioConfigs.push(config);
      return runtime.encodeAudio;
    },
    VideoSampleSink: class {
      getSample = async () => ({ drawWithFit: vi.fn(), close: runtime.closeSample });
    },
    Conversion: {
      init: async (options: {
        output: {
          tracks: object[];
          state: string;
          cancel: () => Promise<void>;
          options: {
            target: {
              getTarget: (request: object) => { options: { onFinalize: (buffer: ArrayBuffer) => Promise<void> } };
            };
          };
        };
        video: object[];
        audio: object[];
      }) => {
        runtime.conversionOptions = options;
        options.output.tracks = Array.from({ length: options.video.length * (runtime.hasAudio ? 2 : 1) }, () => ({}));
        return {
          isValid: true,
          discardedTracks: runtime.discarded ? [{}] : [],
          cancel: options.output.cancel,
          execute: async () => {
            const target = options.output.options.target.getTarget({
              path: 'stream_360p_000.ts',
              mimeType: 'video/mp2t',
            });
            runtime.finalization = target.options.onFinalize(new ArrayBuffer(3));
            await runtime.finalization;
            options.output.state = 'finalized';
          },
        };
      },
    },
  };
});

beforeEach(() => {
  runtime.encodeVideo = true;
  runtime.encodeAudio = true;
  runtime.hasAudio = true;
  runtime.discarded = false;
  runtime.finalization = undefined;
  runtime.conversionOptions = undefined;
  runtime.videoConfigs = [];
  runtime.audioConfigs = [];
  vi.clearAllMocks();
  vi.stubGlobal('VideoDecoder', class {});
  vi.stubGlobal('VideoEncoder', class {});
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext = () => ({});
      convertToBlob = async () => new Blob(['thumbnail'], { type: 'image/webp' });
    },
  );
});

function options(onArtifact = vi.fn(async () => undefined)) {
  return { signal: new AbortController().signal, codecAssetBaseUrl: '/codecs', onProgress: vi.fn(), onArtifact };
}

describe('browser video processing', () => {
  it('uses explicit bitrate quality for both capability checks and actual encoders', async () => {
    await processClientVideo(new File(['input'], 'video.mp4'), options());
    const videoRates = [800_000, 1_500_000, 3_000_000];
    expect(runtime.videoConfigs.map((config) => (config as { quality: object }).quality)).toEqual(
      videoRates.map((bitrate) => ({ options: { bitrate } })),
    );
    expect(runtime.audioConfigs).toEqual([expect.objectContaining({ quality: { options: { bitrate: 128_000 } } })]);
    expect(runtime.conversionOptions?.video).toEqual(
      videoRates.map((bitrate) => expect.objectContaining({ quality: { options: { bitrate } } })),
    );
    expect(runtime.conversionOptions?.audio).toEqual(
      videoRates.map(() => expect.objectContaining({ quality: { options: { bitrate: 128_000 } } })),
    );
  });
  it('does not upscale small or portrait sources into larger presets', () => {
    expect(selectVideoRenditions(1280, 720).map((rendition) => rendition.name)).toEqual(['360p', '480p', '720p']);
    expect(selectVideoRenditions(640, 360).map((rendition) => rendition.name)).toEqual(['360p']);
    expect(selectVideoRenditions(359, 639)).toEqual([
      { name: 'original', width: 360, height: 640, bitrate: 3_000_000 },
    ]);
  });

  it('rejects unsupported encoding before persisting any artifacts', async () => {
    runtime.encodeVideo = false;
    const callbacks = options();
    await expect(processClientVideo(new File(['input'], 'video.mp4'), callbacks)).rejects.toBeInstanceOf(
      ClientMediaUnavailableError,
    );
    expect(callbacks.onArtifact).not.toHaveBeenCalled();
    expect(runtime.dispose).toHaveBeenCalledOnce();
  });

  it('supports silent video when AAC encoding is unavailable', async () => {
    runtime.hasAudio = false;
    runtime.encodeAudio = false;
    const callbacks = options();
    await expect(processClientVideo(new File(['input'], 'video.mp4'), callbacks)).resolves.toEqual({
      kind: 'video',
      width: 1280,
      height: 720,
      durationSeconds: 15,
    });
    expect(runtime.conversionOptions?.audio).toEqual({ discard: true });
    expect(callbacks.onArtifact).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'thumbnail.webp', mimeType: 'image/webp' }),
    );
  });

  it('awaits artifact persistence and preserves unexpected storage failures', async () => {
    const failure = new Error('OPFS write failed');
    const callbacks = options(
      vi.fn(async () => {
        throw failure;
      }),
    );
    await expect(processClientVideo(new File(['input'], 'video.mp4'), callbacks)).rejects.toBe(failure);
    await expect(runtime.finalization).rejects.toBe(failure);
    expect(runtime.cancel).toHaveBeenCalledOnce();
    expect(runtime.closeSample).toHaveBeenCalledOnce();
    expect(runtime.dispose).toHaveBeenCalledOnce();
  });

  it('rejects partially discarded fanout before output persistence', async () => {
    runtime.discarded = true;
    const callbacks = options();
    await expect(processClientVideo(new File(['input'], 'video.mp4'), callbacks)).rejects.toBeInstanceOf(
      ClientMediaUnavailableError,
    );
    expect(callbacks.onArtifact).not.toHaveBeenCalled();
  });

  it('keeps muxer persistence callbacks resolved when an in-flight write is canceled', async () => {
    const controller = new AbortController();
    const reason = new DOMException('Stopped during persistence', 'AbortError');
    const callbacks = {
      ...options(),
      signal: controller.signal,
      onArtifact: vi.fn(async () => {
        controller.abort(reason);
        throw reason;
      }),
    };
    await expect(processClientVideo(new File(['input'], 'video.mp4'), callbacks)).rejects.toBe(reason);
    // The muxer callback resolved; only the owning process rejects with AbortError.
    await expect(runtime.finalization).resolves.toBeUndefined();
    expect(callbacks.onArtifact).toHaveBeenCalledOnce();
  });
});
