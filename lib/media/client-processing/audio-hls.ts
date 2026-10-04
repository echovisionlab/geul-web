import {
  EncodedAudioPacketSource,
  EncodedPacket,
  HlsOutputFormat,
  MpegTsOutputFormat,
  Output,
  PathedTarget,
  StreamTarget,
} from 'mediabunny';
import type { AudioStreamOutputChunk } from '@echovisionlab/audio-transcoder';
import type { ProcessingOptions } from './contracts';

const MAX_ARTIFACT_BYTES = 8 * 1024 * 1024;
const SAMPLE_RATE = 44100;

/** Parses a continuous AAC-LC ADTS stream without buffering the encoded file. */
export class AdtsParser {
  private pending = new Uint8Array(0);
  private frames = 0;
  private first = true;
  constructor(
    private readonly onPacket: (packet: EncodedPacket, metadata?: EncodedAudioChunkMetadata) => Promise<void>,
  ) {}

  async write(data: Uint8Array): Promise<void> {
    const bytes = new Uint8Array(this.pending.length + data.length);
    bytes.set(this.pending);
    bytes.set(data, this.pending.length);
    let offset = 0;
    while (bytes.length - offset >= 7) {
      const frame = bytes.subarray(offset);
      if (frame[0] !== 0xff || (frame[1]! & 0xf6) !== 0xf0) {
        throw new Error('Invalid AAC ADTS sync or layer.');
      }
      const objectType = (frame[2]! >> 6) + 1;
      const rateIndex = (frame[2]! >> 2) & 15;
      const channels = ((frame[2]! & 1) << 2) | (frame[3]! >> 6);
      const headerBytes = frame[1]! & 1 ? 7 : 9;
      const length = ((frame[3]! & 3) << 11) | (frame[4]! << 3) | (frame[5]! >> 5);
      if (objectType !== 2 || rateIndex !== 4 || channels !== 2 || (frame[6]! & 3) !== 0 || length <= headerBytes) {
        throw new Error('AAC encoder returned an incompatible ADTS frame.');
      }
      if (frame.length < length) {
        break;
      }
      const packet = new EncodedPacket(
        frame.slice(headerBytes, length),
        'key',
        this.frames / SAMPLE_RATE,
        1024 / SAMPLE_RATE,
        this.frames / 1024,
      );
      const metadata = this.first
        ? {
            decoderConfig: {
              codec: 'mp4a.40.2',
              sampleRate: SAMPLE_RATE,
              numberOfChannels: 2,
              description: new Uint8Array([0x12, 0x10]),
            },
          }
        : undefined;
      await this.onPacket(packet, metadata);
      this.first = false;
      this.frames += 1024;
      offset += length;
    }
    this.pending = bytes.slice(offset);
    if (this.pending.length > 8191) {
      throw new Error('AAC frame exceeds its ADTS length limit.');
    }
  }

  finish(): void {
    if (this.pending.length || this.frames === 0) {
      throw new Error('AAC stream is empty or truncated.');
    }
  }
}

/** A single muxer session; target close awaits artifact persistence. */
export async function createAudioHlsOutput(options: ProcessingOptions) {
  const source = new EncodedAudioPacketSource('aac');
  const output = new Output({
    format: new HlsOutputFormat({
      segmentFormat: new MpegTsOutputFormat(),
      targetDuration: 6,
      live: false,
      getPlaylistPath: () => 'audio.m3u8',
      getSegmentPath: ({ n }) => `segment_${String(n).padStart(6, '0')}.ts`,
    }),
    target: new PathedTarget('master.m3u8', ({ path }) => {
      return createArtifactTarget(path, options);
    }),
  });
  output.addAudioTrack(source);
  await output.start();
  const parser = new AdtsParser((packet, metadata) => {
    options.signal.throwIfAborted();
    return source.add(packet, metadata);
  });
  let inputPosition = 0;
  let cancellation: Promise<void> | undefined;
  const cancel = (): Promise<void> => {
    cancellation ??= (async () => {
      // A canceled output force-closes its connected source. Starting a normal
      // source.close() here would create a detached finalization promise.
      if (output.state !== 'canceled' && output.state !== 'finalized') {
        await output.cancel();
      }
    })();
    return cancellation;
  };
  const writable = new WritableStream<AudioStreamOutputChunk>({
    async write(chunk) {
      options.signal.throwIfAborted();
      if (chunk.position !== inputPosition) {
        throw new Error('AAC encoder output must be append-only.');
      }
      inputPosition += chunk.data.byteLength;
      await parser.write(chunk.data);
    },
    async close() {
      parser.finish();
      source.close();
      await output.finalize();
    },
    abort: cancel,
  });
  return { writable, cancel };
}

function createArtifactTarget(path: string, options: ProcessingOptions): StreamTarget {
  if (!/^[a-zA-Z0-9_-]+\.(?:m3u8|ts)$/.test(path)) {
    throw new Error('Unsafe HLS artifact path.');
  }
  let position = 0;
  let chunks: Uint8Array<ArrayBuffer>[] = [];
  return new StreamTarget(
    new WritableStream({
      write(chunk) {
        options.signal.throwIfAborted();
        if (chunk.position !== position) {
          throw new Error('HLS output must be append-only.');
        }
        position += chunk.data.byteLength;
        if (position > MAX_ARTIFACT_BYTES) {
          throw new Error('HLS artifact exceeds the bounded target limit.');
        }
        chunks.push(chunk.data.slice());
      },
      async close() {
        options.signal.throwIfAborted();
        const mimeType = path.endsWith('.ts') ? 'video/mp2t' : 'application/vnd.apple.mpegurl';
        const blob = new Blob(chunks, { type: mimeType });
        chunks = [];
        await options.onArtifact({ path, mimeType, blob });
        options.signal.throwIfAborted();
      },
      abort() {
        chunks = [];
      },
    }),
    { chunked: true, chunkSize: 64 * 1024 },
  );
}
