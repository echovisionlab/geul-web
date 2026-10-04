import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { AudioAnalysis, SPECTROGRAM_HEIGHT, SPECTROGRAM_WIDTH } from './audio-analysis';

describe('streaming audio analysis', () => {
  it('preserves signed channel peaks, rounding and overlapping buckets on very short audio', () => {
    const analysis = new AudioAnalysis(2, 2);
    analysis.consume(new Float32Array([-1, 0.25, 0.5, -0.75]));
    analysis.finish();
    expect(analysis.peaks).toHaveLength(2);
    expect(analysis.peaks[0]).toHaveLength(2048);
    expect(analysis.peaks[0]!.slice(0, 1024).every((peak) => peak === -1)).toBe(true);
    expect(analysis.peaks[1]!.slice(1024).every((peak) => peak === -0.75)).toBe(true);
    expect(analysis.pixels).toHaveLength(SPECTROGRAM_WIDTH * SPECTROGRAM_HEIGHT * 4);
  });

  it('produces the same analysis across arbitrary PCM chunk boundaries', () => {
    const samples = Float32Array.from(
      { length: 8000 },
      (_, frame) => Math.sin((2 * Math.PI * 1000 * frame) / 8000) * 0.5,
    );
    const whole = new AudioAnalysis(1, 8000);
    const chunked = new AudioAnalysis(1, 8000);
    whole.consume(samples);
    for (let offset = 0; offset < samples.length; offset += 137) {
      chunked.consume(samples.subarray(offset, offset + 137));
    }
    whole.finish();
    chunked.finish();
    expect(chunked.peaks).toEqual(whole.peaks);
    // Buffer equality compares every pixel byte and the full length.
    expect(Buffer.from(chunked.pixels).equals(Buffer.from(whole.pixels))).toBe(true);
    const toneRow = Math.round(
      SPECTROGRAM_HEIGHT - 1 - (Math.log(1000 / 20) / Math.log(4000 / 20)) * (SPECTROGRAM_HEIGHT - 1),
    );
    const redAtRow = (row: number) => whole.pixels[(row * SPECTROGRAM_WIDTH + 800) * 4]!;
    expect(redAtRow(toneRow)).toBeGreaterThan(redAtRow(0));
  });

  it('rejects incomplete frames and non-finite PCM', () => {
    expect(() => new AudioAnalysis(2, 1).consume(new Float32Array([1]))).toThrow('Incomplete');
    expect(() => new AudioAnalysis(1, 1).consume(new Float32Array([NaN]))).toThrow('Non-finite');
    expect(() => new AudioAnalysis(1, 1).finish()).toThrow('no PCM');
  });
});
