import { ClientMediaUnavailableError } from './contracts';

type Channel = 'FL' | 'FR' | 'FC' | 'LFE' | 'BL' | 'BR' | 'BC' | 'SL' | 'SR';
const DEFAULT_LAYOUTS: Record<number, readonly Channel[]> = {
  3: ['FL', 'FR', 'LFE'],
  4: ['FL', 'FR', 'FC', 'BC'],
  5: ['FL', 'FR', 'FC', 'BL', 'BR'],
  6: ['FL', 'FR', 'FC', 'LFE', 'BL', 'BR'],
  7: ['FL', 'FR', 'FC', 'LFE', 'BC', 'SL', 'SR'],
  8: ['FL', 'FR', 'FC', 'LFE', 'BL', 'BR', 'SL', 'SR'],
};
const MASK_CHANNELS: Array<[number, Channel]> = [
  [1, 'FL'],
  [2, 'FR'],
  [4, 'FC'],
  [8, 'LFE'],
  [16, 'BL'],
  [32, 'BR'],
  [256, 'BC'],
  [512, 'SL'],
  [1024, 'SR'],
];
const CENTER_SURROUND_GAIN = Math.SQRT1_2;
const BACK_CENTER_GAIN = 0.5;
const KNOWN_MASK = MASK_CHANNELS.reduce((mask, [bit]) => mask | bit, 0);
// CoreAudio MPEG layout tags define an explicit, potentially reordered PCM layout.
const CAF_LAYOUTS: Record<number, readonly Channel[]> = {
  113: ['FL', 'FR', 'FC'],
  114: ['FC', 'FL', 'FR'],
  115: ['FL', 'FR', 'FC', 'BC'],
  116: ['FC', 'FL', 'FR', 'BC'],
  117: ['FL', 'FR', 'FC', 'SL', 'SR'],
  118: ['FL', 'FR', 'SL', 'SR', 'FC'],
  119: ['FL', 'FC', 'FR', 'SL', 'SR'],
  120: ['FC', 'FL', 'FR', 'SL', 'SR'],
  121: ['FL', 'FR', 'FC', 'LFE', 'SL', 'SR'],
  122: ['FL', 'FR', 'SL', 'SR', 'FC', 'LFE'],
  123: ['FL', 'FC', 'FR', 'SL', 'SR', 'LFE'],
  124: ['FC', 'FL', 'FR', 'SL', 'SR', 'LFE'],
  125: ['FL', 'FR', 'FC', 'LFE', 'SL', 'SR', 'BC'],
  128: ['FL', 'FR', 'FC', 'LFE', 'SL', 'SR', 'BL', 'BR'],
};

/** FFmpeg's standard stereo float downmix: no LFE, center/surround -3 dB. */
export function downmixAudioPcm(samples: Float32Array, layout: readonly Channel[]): Float32Array {
  if (samples.length % layout.length !== 0) {
    throw new Error('Incomplete multichannel PCM frame.');
  }
  const frames = samples.length / layout.length;
  const output = new Float32Array(frames * 2);
  for (let frame = 0; frame < frames; frame++) {
    let left = 0;
    let right = 0;
    for (let channel = 0; channel < layout.length; channel++) {
      const sample = samples[frame * layout.length + channel]!;
      if (!Number.isFinite(sample)) {
        throw new Error('Non-finite multichannel PCM sample.');
      }
      switch (layout[channel]) {
        case 'FL':
          left += sample;
          break;
        case 'FR':
          right += sample;
          break;
        case 'FC':
          left += sample * CENTER_SURROUND_GAIN;
          right += sample * CENTER_SURROUND_GAIN;
          break;
        case 'BL':
        case 'SL':
          left += sample * CENTER_SURROUND_GAIN;
          break;
        case 'BR':
        case 'SR':
          right += sample * CENTER_SURROUND_GAIN;
          break;
        case 'BC':
          left += sample * BACK_CENTER_GAIN;
          right += sample * BACK_CENTER_GAIN;
          break;
        case 'LFE':
          break;
      }
    }
    output[frame * 2] = left;
    output[frame * 2 + 1] = right;
  }
  return output;
}

/** Reads container layout metadata only; compressed layouts are never guessed. */
export async function getAudioDownmix(
  file: File,
  channels: number,
  signal: AbortSignal,
): Promise<((samples: Float32Array) => Float32Array) | null> {
  if (channels <= 2) {
    return null;
  }
  const defaultLayout = DEFAULT_LAYOUTS[channels];
  if (!defaultLayout) {
    throw unsupported('This PCM channel layout is unsupported.');
  }
  const header = new DataView(await read(file, 0, 12, signal));
  const form = ascii(header, 0);
  let layout: readonly Channel[];
  if ((form === 'RIFF' || form === 'RF64' || form === 'RIFX') && ascii(header, 8) === 'WAVE') {
    const mask = await readWaveChannelMask(file, form !== 'RIFX', signal);
    layout = mask === null || mask === 0 ? defaultLayout : layoutFromMask(mask, channels);
  } else if (form === 'FORM' && (ascii(header, 8) === 'AIFF' || ascii(header, 8) === 'AIFC')) {
    layout = defaultLayout;
  } else if (form === 'caff') {
    layout = (await readCafLayout(file, channels, signal)) ?? defaultLayout;
  } else {
    throw unsupported('Compressed multichannel audio requires an explicit supported channel layout.');
  }
  return (samples) => downmixAudioPcm(samples, layout);
}

async function readWaveChannelMask(file: File, littleEndian: boolean, signal: AbortSignal): Promise<number | null> {
  for (let offset = 12; offset + 8 <= file.size;) {
    const chunk = new DataView(await read(file, offset, 8, signal));
    const size = chunk.getUint32(4, littleEndian);
    if (ascii(chunk, 0) === 'fmt ') {
      if (size < 16) {
        throw new Error('Invalid WAV format chunk.');
      }
      const format = new DataView(await read(file, offset + 8, Math.min(size, 40), signal));
      if (format.getUint16(0, littleEndian) !== 0xfffe) {
        return null;
      }
      if (size < 40 || format.getUint16(16, littleEndian) < 22) {
        throw new Error('Invalid extensible WAV format chunk.');
      }
      return format.getUint32(20, littleEndian);
    }
    if (ascii(chunk, 0) === 'data') {
      break;
    }
    offset += 8 + size + (size & 1);
  }
  throw new Error('The WAV format chunk is missing.');
}

async function readCafLayout(file: File, channels: number, signal: AbortSignal): Promise<readonly Channel[] | null> {
  for (let offset = 8; offset + 12 <= file.size;) {
    const chunk = new DataView(await read(file, offset, 12, signal));
    const size = Number(chunk.getBigInt64(4, false));
    if (ascii(chunk, 0) === 'chan') {
      if (size < 12) {
        throw new Error('Truncated CAF channel layout.');
      }
      const metadata = new DataView(await read(file, offset + 12, 12, signal));
      const tag = metadata.getUint32(0, false);
      if (tag === 65536 && metadata.getUint32(8, false) === 0) {
        return layoutFromMask(metadata.getUint32(4, false), channels);
      }
      const layout = CAF_LAYOUTS[tag >>> 16];
      const matchingCount = (tag & 65535) === channels && layout?.length === channels;
      const hasDescriptions = metadata.getUint32(8, false) !== 0;
      if (!layout || !matchingCount || hasDescriptions) {
        throw unsupported('The CAF channel layout is unsupported.');
      }
      return layout;
    }
    if (size < 0) {
      return null;
    }
    if (!Number.isSafeInteger(size)) {
      throw new Error('Invalid CAF chunk size.');
    }
    offset += 12 + size;
  }
  return null;
}

function layoutFromMask(mask: number, channels: number): readonly Channel[] {
  if ((mask & ~KNOWN_MASK) !== 0) {
    throw unsupported('The audio channel mask contains unsupported speaker positions.');
  }
  const layout = MASK_CHANNELS.filter(([bit]) => (mask & bit) !== 0).map(([, channel]) => channel);
  if (layout.length !== channels) {
    throw unsupported('The audio channel mask does not match its channel count.');
  }
  return layout;
}

async function read(file: File, offset: number, size: number, signal: AbortSignal): Promise<ArrayBuffer> {
  signal.throwIfAborted();
  if (!Number.isSafeInteger(offset) || offset < 0 || offset + size > file.size) {
    throw new Error('Truncated audio channel-layout metadata.');
  }
  const bytes = await file.slice(offset, offset + size).arrayBuffer();
  signal.throwIfAborted();
  return bytes;
}
function ascii(view: DataView, offset: number): string {
  return String.fromCharCode(...Array.from({ length: 4 }, (_, index) => view.getUint8(offset + index)));
}
function unsupported(message: string): ClientMediaUnavailableError {
  return new ClientMediaUnavailableError(message, 'source');
}
