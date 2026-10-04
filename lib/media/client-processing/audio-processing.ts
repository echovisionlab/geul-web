import {
  createAudioTranscoderCodecAssetProvider as createCodecAssets,
  createAudioTranscoderStreamEngine as createStreamEngine,
  createDefaultAudioTranscoderStreamCodecRuntime as createCodecRuntime,
  createSelfHostedRuntimeAssetSource,
  type AudioStreamInputAdapter,
  type PcmStreamSource,
  type StreamingResampler,
} from '@echovisionlab/audio-transcoder';
import { ALL_FORMATS, CustomSource, Input } from 'mediabunny';
import { AudioAnalysis, AUDIO_ANALYSIS_RATE } from './audio-analysis';
import { createAudioHlsOutput } from './audio-hls';
import { getAudioDownmix } from './audio-downmix';
import { ClientMediaUnavailableError, type MediaMetadata, type ProcessingOptions } from './contracts';

/** Generates all audio derivatives in one bounded decoded PCM pass inside a Worker. */
export async function processClientAudio(file: File, options: ProcessingOptions): Promise<MediaMetadata> {
  options.signal.throwIfAborted();
  requireSpectrogramCanvas();
  const assets = createCodecAssets({ source: createSelfHostedRuntimeAssetSource(options.codecAssetBaseUrl) });
  const runtime = createCodecRuntime(assets);
  const preflight = createStreamEngine({ codecRuntime: runtime });
  const input = { blob: file, name: file.name };
  const support = await preflight.probeInputSupport(input, { signal: options.signal });
  if (support.status !== 'supported') {
    throw new ClientMediaUnavailableError('Audio decoding is unavailable for this source.');
  }
  const inspection = support.inspection;
  const sourceChannels = inspection.channels;
  const sampleRate = inspection.sampleRate;
  const duration = inspection.durationSeconds ?? (await computeAudioDuration(file, options.signal));
  const validChannels = sourceChannels !== null && !(sourceChannels < 1);
  const validRate = sampleRate !== null && !(sampleRate < 8000 || sampleRate > 192000);
  const validDuration = duration !== null && Number.isFinite(duration) && duration > 0;
  if (!validChannels || !validRate || !validDuration) {
    throw new ClientMediaUnavailableError('Audio requires a known duration and supported source parameters.');
  }
  const downmix = await getAudioDownmix(file, sourceChannels, options.signal);
  const channels = downmix ? 2 : sourceChannels;
  const totalFrames = Math.ceil(duration * AUDIO_ANALYSIS_RATE);
  if (!Number.isSafeInteger(totalFrames)) {
    throw new ClientMediaUnavailableError('Audio duration exceeds the analysis limit.');
  }
  const outputSupport = await preflight.probeOutputSupport(
    { presetId: 'aac-192kbps', channels: 2, sampleRate: 44100 },
    { signal: options.signal },
  );
  if (outputSupport.status !== 'supported') {
    throw new ClientMediaUnavailableError('Audio AAC encoding is unavailable.');
  }
  const analysis = new AudioAnalysis(channels, totalFrames);
  let decoderPasses = 0;
  const inputs = runtime.inputs.map((adapter): AudioStreamInputAdapter => ({
    ...adapter,
    async open(sourceInput, context) {
      const source = await adapter.open(sourceInput, context);
      if (!source) {
        return null;
      }
      decoderPasses++;
      if (source.channels !== sourceChannels || source.sampleRate !== sampleRate) {
        source.close();
        throw new Error('Audio parameters changed after preflight.');
      }
      let resampler;
      try {
        resampler = await runtime.resampler.create(
          channels,
          sampleRate,
          AUDIO_ANALYSIS_RATE,
          'balanced',
          options.signal,
        );
      } catch (error) {
        source.close();
        throw error;
      }
      return wrapAnalysisSource(source, { channels, duration, downmix, resampler, analysis, signal: options.signal });
    },
  }));
  const engine = createStreamEngine({ codecRuntime: { ...runtime, inputs } });
  const hls = await createAudioHlsOutput(options);
  try {
    await engine.transcode(input, { presetId: 'aac-192kbps', channels: 2, sampleRate: 44100 }, hls.writable, {
      signal: options.signal,
      inputReadBytes: 1024 * 1024,
      pcmChunkBytes: 256 * 1024,
      outputChunkBytes: 64 * 1024,
      onProgress(progress) {
        const processed = progress.processedSeconds;
        if (processed !== null) {
          options.onProgress(Math.min(0.95, (processed / duration) * 0.95));
        }
      },
    });
    if (decoderPasses !== 1) {
      throw new Error('Audio processing must use one PCM decoder.');
    }
    await writeAnalysisArtifacts(analysis, options);
    options.onProgress(1);
    return { kind: 'audio', durationSeconds: duration };
  } catch (error) {
    await hls.cancel().catch(() => undefined);
    throw error;
  }
}

function requireSpectrogramCanvas(): void {
  const unavailable =
    typeof OffscreenCanvas === 'undefined' ||
    typeof ImageData === 'undefined' ||
    !new OffscreenCanvas(1, 1).getContext('2d');
  if (unavailable) {
    throw new ClientMediaUnavailableError('Audio spectrogram rendering is unavailable.');
  }
}

interface AnalysisSourceOptions {
  channels: number;
  duration: number;
  downmix: ((samples: Float32Array) => Float32Array) | null;
  resampler: StreamingResampler | null;
  analysis: AudioAnalysis;
  signal: AbortSignal;
}

/** Keeps the analysis tap before encoder gain and owns the analysis resampler. */
function wrapAnalysisSource(source: PcmStreamSource, options: AnalysisSourceOptions): PcmStreamSource {
  const { channels, duration, downmix, resampler, analysis, signal } = options;
  let frames = 0;
  return {
    ...source,
    channels,
    inspection: { ...source.inspection, channels },
    durationSeconds: duration,
    async *chunks(chunkSignal) {
      for await (const samples of source.chunks(chunkSignal)) {
        signal.throwIfAborted();
        const mixed = downmix ? downmix(samples) : samples;
        frames += mixed.length / channels;
        consumeAnalysis(analysis, resampler?.process(mixed) ?? [mixed]);
        yield encoderPcm(mixed, channels);
      }
      if (resampler) {
        consumeAnalysis(analysis, resampler.flush(frames));
      }
    },
    close() {
      resampler?.close();
      source.close();
    },
  };
}

function consumeAnalysis(analysis: AudioAnalysis, chunks: Iterable<Float32Array>): void {
  for (const samples of chunks) {
    analysis.consume(samples);
  }
}

function encoderPcm(samples: Float32Array, channels: number): Float32Array {
  if (channels !== 1) {
    return samples;
  }
  // FFmpeg -ac 2 sends mono to each stereo channel at -3 dB. The shared
  // encoder duplicates mono at unity; compensate after original-level analysis.
  const output = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index++) {
    output[index] = samples[index]! * Math.SQRT1_2;
  }
  return output;
}

async function writeAnalysisArtifacts(analysis: AudioAnalysis, options: ProcessingOptions): Promise<void> {
  options.signal.throwIfAborted();
  analysis.finish();
  const waveform = new Blob([JSON.stringify(analysis.peaks)], { type: 'application/json' });
  await options.onArtifact({ path: 'waveform.json', mimeType: 'application/json', blob: waveform });
  options.signal.throwIfAborted();
  const png = await analysis.png();
  options.signal.throwIfAborted();
  await options.onArtifact({ path: 'spectrogram.png', mimeType: 'image/png', blob: png });
  options.signal.throwIfAborted();
}

/** Scans compressed packet timestamps when a container has no duration header. */
async function computeAudioDuration(file: File, signal: AbortSignal): Promise<number> {
  const maxReadBytes = 8 * 1024 * 1024;
  const input = new Input({
    formats: ALL_FORMATS,
    source: new CustomSource({
      getSize: () => file.size,
      maxCacheSize: maxReadBytes,
      prefetchProfile: 'none',
      async read(start, end) {
        signal.throwIfAborted();
        if (end - start > maxReadBytes) {
          throw new Error('Audio duration scan exceeded its bounded read limit.');
        }
        const bytes = new Uint8Array(await file.slice(start, end).arrayBuffer());
        signal.throwIfAborted();
        return bytes;
      },
    }),
  });
  const abort = () => input.dispose();
  signal.addEventListener('abort', abort, { once: true });
  try {
    signal.throwIfAborted();
    const track = await input.getPrimaryAudioTrack();
    signal.throwIfAborted();
    if (!track) {
      throw new Error('Audio duration scan did not find an audio track.');
    }
    const duration = await track.computeDuration({ metadataOnly: true });
    signal.throwIfAborted();
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('Audio packet duration is invalid.');
    }
    return duration;
  } catch (error) {
    signal.throwIfAborted();
    throw error;
  } finally {
    signal.removeEventListener('abort', abort);
    input.dispose();
  }
}
