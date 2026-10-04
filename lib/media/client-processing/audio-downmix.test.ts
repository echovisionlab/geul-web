import { describe, expect, it } from 'vitest';
import { getAudioDownmix } from './audio-downmix';
import { ClientMediaUnavailableError } from './contracts';

// Independent float PCM impulse reference measured with FFmpeg 8.1.2 -ac 2.
const REFERENCE: Record<number, number[][]> = {
  3: [
    [1, 0],
    [0, 1],
    [0, 0],
  ],
  4: [
    [1, 0],
    [0, 1],
    [0.70710677, 0.70710677],
    [0.5, 0.5],
  ],
  5: [
    [1, 0],
    [0, 1],
    [0.70710677, 0.70710677],
    [0.70710677, 0],
    [0, 0.70710677],
  ],
  6: [
    [1, 0],
    [0, 1],
    [0.70710677, 0.70710677],
    [0, 0],
    [0.70710677, 0],
    [0, 0.70710677],
  ],
  7: [
    [1, 0],
    [0, 1],
    [0.70710677, 0.70710677],
    [0, 0],
    [0.5, 0.5],
    [0.70710677, 0],
    [0, 0.70710677],
  ],
  8: [
    [1, 0],
    [0, 1],
    [0.70710677, 0.70710677],
    [0, 0],
    [0.70710677, 0],
    [0, 0.70710677],
    [0.70710677, 0],
    [0, 0.70710677],
  ],
};

describe('layout-aware PCM stereo downmix', () => {
  it.each([3, 4, 5, 6, 7, 8])('matches FFmpeg default %i-channel impulse coefficients', async (channels) => {
    const pcm = new Float32Array(channels * channels);
    for (let i = 0; i < channels; i++) {
      pcm[i * channels + i] = 1;
    }
    for (const file of [
      wave(channels),
      new File(['FORMxxxxAIFF'], 'source.aiff'),
      new File(['caff\x00\x01\x00\x00\x00\x00\x00\x00'], 'source.caf'),
    ]) {
      const mix = await getAudioDownmix(file, channels, new AbortController().signal);
      const output = mix!(pcm);
      for (let i = 0; i < channels; i++) {
        expect(output[i * 2]).toBeCloseTo(REFERENCE[channels]![i]![0]!, 7);
        expect(output[i * 2 + 1]).toBeCloseTo(REFERENCE[channels]![i]![1]!, 7);
      }
    }
  });

  it('honors an extensible WAV quad mask instead of guessing default 4.0', async () => {
    const mix = await getAudioDownmix(wave(4, 0x33), 4, new AbortController().signal);
    expect([...mix!(new Float32Array([0, 0, 1, 0]))]).toEqual([Math.fround(Math.SQRT1_2), 0]);
  });

  it('honors explicit CAF MPEG 5.1 channel ordering', async () => {
    const bytes = new Uint8Array(32);
    bytes.set(new TextEncoder().encode('caff'), 0);
    bytes.set(new TextEncoder().encode('chan'), 8);
    const view = new DataView(bytes.buffer);
    view.setBigInt64(12, 12n, false);
    view.setUint32(20, (122 << 16) | 6, false);
    const mix = await getAudioDownmix(new File([bytes], 'source.caf'), 6, new AbortController().signal);
    expect([...mix!(new Float32Array([0, 0, 0, 0, 1, 0]))]).toEqual([
      Math.fround(Math.SQRT1_2),
      Math.fround(Math.SQRT1_2),
    ]);
  });

  it('rejects unknown masks, mismatched masks and compressed channel order before decoding', async () => {
    const signal = new AbortController().signal;
    await expect(getAudioDownmix(wave(6, 0x4003f), 6, signal)).rejects.toBeInstanceOf(ClientMediaUnavailableError);
    await expect(getAudioDownmix(wave(6, 0x33), 6, signal)).rejects.toBeInstanceOf(ClientMediaUnavailableError);
    await expect(
      getAudioDownmix(new File(['compressed fake source'], 'source.flac'), 6, signal),
    ).rejects.toBeInstanceOf(ClientMediaUnavailableError);
  });
});

function wave(channels: number, mask?: number): File {
  const bytes = new Uint8Array(mask === undefined ? 44 : 68);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('RIFF'), 0);
  bytes.set(new TextEncoder().encode('WAVEfmt '), 8);
  view.setUint32(16, mask === undefined ? 16 : 40, true);
  view.setUint16(20, mask === undefined ? 1 : 0xfffe, true);
  view.setUint16(22, channels, true);
  if (mask !== undefined) {
    view.setUint16(36, 22, true);
    view.setUint32(40, mask, true);
  }
  return new File([bytes], 'source.wav');
}
