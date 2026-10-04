import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  canEncodeAudio,
  canEncodeVideo,
  Conversion,
  HlsOutputFormat,
  Input,
  type InputVideoTrack,
  type InputAudioTrack,
  MpegTsOutputFormat,
  Output,
  OutputTrackGroup,
  PathedTarget,
  Quality,
  VideoSampleSink,
} from 'mediabunny';
import { ensureAudioCodecs } from './browser-runtime';
import { normalizeVideoTransportStream } from './video-hls';
import { encodeVideoThumbnail } from './video-thumbnail';
import { ClientMediaUnavailableError, type MediaMetadata, type ProcessingOptions } from './contracts';

const PRESETS = [
  { name: '360p', width: 640, height: 360, bitrate: 800_000 },
  { name: '480p', width: 854, height: 480, bitrate: 1_500_000 },
  { name: '720p', width: 1280, height: 720, bitrate: 3_000_000 },
] as const;

/** Match the server's non-upscaling preset selection, including its original-size fallback. */
export function selectVideoRenditions(width: number, height: number) {
  const selected = PRESETS.filter((preset) => preset.width <= width && preset.height <= height);
  return selected.length > 0
    ? selected
    : [
        {
          name: 'original',
          // AVC requires even dimensions. Round the containing box up without cropping the image.
          width: Math.ceil(width / 2) * 2,
          height: Math.ceil(height / 2) * 2,
          bitrate: 3_000_000,
        },
      ];
}

type Rendition = ReturnType<typeof selectVideoRenditions>[number];
interface VideoPlan {
  video: InputVideoTrack;
  audio: InputAudioTrack | null;
  width: number;
  height: number;
  start: number;
  end: number;
  durationSeconds: number;
  renditions: Rendition[];
}

function videoEncoding(rendition: Rendition) {
  return {
    width: rendition.width,
    height: rendition.height,
    quality: new Quality({ bitrate: rendition.bitrate }),
  };
}

function audioEncoding() {
  return { sampleRate: 44_100, numberOfChannels: 2, quality: new Quality({ bitrate: 128_000 }) };
}

async function inspectVideo(input: Input, signal: AbortSignal): Promise<VideoPlan> {
  if (!(await input.canRead())) {
    throw new ClientMediaUnavailableError('This video container cannot be processed on this device.', 'source');
  }
  const video = await input.getPrimaryVideoTrack();
  const audio = await input.getPrimaryAudioTrack();
  if (!video || !(await video.canDecode()) || (audio && !(await audio.canDecode()))) {
    throw new ClientMediaUnavailableError('This video contains a codec this device cannot decode.', 'source');
  }
  if (await video.hasHighDynamicRange()) {
    throw new ClientMediaUnavailableError('Browser HDR video conversion is not available.');
  }
  const width = await video.getDisplayWidth();
  const height = await video.getDisplayHeight();
  const tracks = audio ? [video, audio] : [video];
  const start = Math.max(0, await input.getFirstTimestamp(tracks));
  const end = await input.computeDuration(tracks);
  const durationSeconds = end - start;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || width <= 0 || height <= 0) {
    throw new Error('The video has invalid dimensions or duration.');
  }
  const renditions = selectVideoRenditions(width, height);
  for (const rendition of renditions) {
    signal.throwIfAborted();
    if (!(await canEncodeVideo('avc', videoEncoding(rendition)))) {
      throw new ClientMediaUnavailableError('This device cannot encode the required H.264 video.');
    }
  }
  if (audio && !(await canEncodeAudio('aac', audioEncoding()))) {
    throw new ClientMediaUnavailableError('This device cannot encode AAC audio.');
  }
  signal.throwIfAborted();

  return { video, audio, width, height, start, end, durationSeconds, renditions };
}

async function createThumbnail(plan: VideoPlan, signal: AbortSignal): Promise<Blob> {
  // Decode one original-sized frame. WebP capability is checked before producing HLS artifacts.
  const sample = await new VideoSampleSink(plan.video).getSample(plan.start + Math.floor(plan.durationSeconds / 2));
  if (!sample) {
    throw new Error('The video has no frame for its thumbnail.');
  }
  let thumbnail: Blob;
  try {
    const canvas = new OffscreenCanvas(Math.ceil(plan.width), Math.ceil(plan.height));
    const context = canvas.getContext('2d');
    if (!context) {
      throw new ClientMediaUnavailableError('This device cannot draw a video thumbnail.');
    }
    sample.drawWithFit(context, { fit: 'contain' });
    thumbnail = await encodeVideoThumbnail(canvas, context, signal);
  } finally {
    sample.close();
  }

  return thumbnail;
}

function createVideoOutput(renditions: Rendition[], options: ProcessingOptions) {
  const { signal } = options;
  return new Output({
    format: new HlsOutputFormat({
      segmentFormat: new MpegTsOutputFormat(),
      targetDuration: 6,
      getPlaylistPath: ({ n }) => `stream_${renditions[n - 1].name}.m3u8`,
      getSegmentPath: ({ n, playlist }) =>
        `stream_${renditions[playlist.n - 1].name}_${String(n - 1).padStart(3, '0')}.ts`,
    }),
    target: new PathedTarget(
      'master.m3u8',
      ({ path, mimeType }) =>
        new BufferTarget({
          onFinalize: async (buffer) => {
            // Cancel the conversion at its owner, not through muxer callbacks. Custom AAC flush
            // promises in 1.55.1 are detached; rejecting this callback on abort can leak one.
            if (signal.aborted) {
              return;
            }
            try {
              await options.onArtifact({
                path,
                mimeType,
                blob: new Blob([path.endsWith('.ts') ? normalizeVideoTransportStream(buffer) : buffer], {
                  type: mimeType,
                }),
              });
            } catch (error) {
              if (!signal.aborted) {
                throw error;
              }
            }
          },
        }),
    ),
  });
}

async function createConversion(input: Input, output: Output, plan: VideoPlan) {
  const groups = plan.renditions.map(() => new OutputTrackGroup());
  const conversion = await Conversion.init({
    input,
    output,
    tracks: 'primary',
    trim: { start: plan.start, end: plan.end },
    showWarnings: false,
    video: plan.renditions.map((rendition, index) => ({
      codec: 'avc',
      ...videoEncoding(rendition),
      fit: 'contain',
      keyFrameInterval: 6,
      allowRotationMetadata: false,
      forceTranscode: true,
      group: groups[index],
    })),
    audio: plan.audio
      ? plan.renditions.map((_, index) => ({
          codec: 'aac',
          ...audioEncoding(),
          forceTranscode: true,
          group: groups[index],
        }))
      : { discard: true },
  });
  if (
    !conversion.isValid ||
    conversion.discardedTracks.length > 0 ||
    output.tracks.length !== plan.renditions.length * (plan.audio ? 2 : 1)
  ) {
    throw new ClientMediaUnavailableError('The required video renditions cannot be encoded on this device.');
  }
  return conversion;
}

/** Own cancellation and cleanup while the source, muxer and conversion are being initialized. */
class VideoSession {
  output?: Output;
  conversion?: Conversion;
  private cancellation?: Promise<void>;
  private readonly abort = () => {
    this.cancellation = this.conversion ? this.conversion.cancel() : this.output?.cancel();
    // The owner awaits cancellation in close; prevent a detached rejection from the event listener.
    void this.cancellation?.catch(() => undefined);
  };
  constructor(
    readonly input: Input,
    private readonly signal: AbortSignal,
  ) {
    signal.addEventListener('abort', this.abort, { once: true });
  }
  async close(): Promise<void> {
    this.signal.removeEventListener('abort', this.abort);
    if (this.cancellation) {
      await this.cancellation;
    }
    if (this.output && this.output.state !== 'finalized' && this.output.state !== 'canceled') {
      await this.output.cancel();
    }
    this.input.dispose();
  }
}

/** Produce bounded six-second HLS artifacts, persisting each before continuing. */
export async function processClientVideo(file: File, options: ProcessingOptions): Promise<MediaMetadata> {
  const { signal } = options;
  signal.throwIfAborted();
  if (
    typeof VideoDecoder === 'undefined' ||
    typeof VideoEncoder === 'undefined' ||
    typeof OffscreenCanvas === 'undefined'
  ) {
    throw new ClientMediaUnavailableError('This device does not support browser video processing.');
  }
  await ensureAudioCodecs({ codecAssetBaseUrl: options.codecAssetBaseUrl });
  signal.throwIfAborted();
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file, { maxCacheSize: 8 * 1024 * 1024 }) });
  const session = new VideoSession(input, signal);
  try {
    const plan = await inspectVideo(input, signal);
    const thumbnail = await createThumbnail(plan, signal);
    signal.throwIfAborted();
    session.output = createVideoOutput(plan.renditions, options);
    session.conversion = await createConversion(input, session.output, plan);
    signal.throwIfAborted();
    session.conversion.onProgress = (progress) => options.onProgress(progress * 0.98);
    await session.conversion.execute();
    signal.throwIfAborted();
    await options.onArtifact({ path: 'thumbnail.webp', mimeType: 'image/webp', blob: thumbnail });
    signal.throwIfAborted();
    options.onProgress(1);
    return { kind: 'video', durationSeconds: plan.durationSeconds, width: plan.width, height: plan.height };
  } catch (error) {
    signal.throwIfAborted();
    throw error;
  } finally {
    await session.close();
  }
}
