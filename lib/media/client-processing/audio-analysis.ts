/** Fixed-size, streaming analysis of 8 kHz interleaved mono/stereo PCM. */
export const AUDIO_ANALYSIS_RATE = 8000;
export const WAVEFORM_POINTS = 2048;
export const SPECTROGRAM_WIDTH = 1600;
export const SPECTROGRAM_HEIGHT = 224;
const FFT_SIZE = 1024;
const HANN = Float64Array.from(
  { length: FFT_SIZE },
  (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)),
);
const COSINE = Float64Array.from({ length: FFT_SIZE / 2 }, (_, i) => Math.cos((-2 * Math.PI * i) / FFT_SIZE));
const SINE = Float64Array.from({ length: FFT_SIZE / 2 }, (_, i) => Math.sin((-2 * Math.PI * i) / FFT_SIZE));
const MAGMA = [
  [0, 0, 4],
  [28, 16, 68],
  [79, 18, 123],
  [129, 37, 129],
  [181, 54, 122],
  [229, 80, 100],
  [251, 135, 97],
  [254, 194, 135],
  [252, 253, 191],
];

export class AudioAnalysis {
  readonly peaks: number[][];
  readonly pixels = new Uint8ClampedArray(SPECTROGRAM_WIDTH * SPECTROGRAM_HEIGHT * 4);
  private readonly ring = new Float64Array(FFT_SIZE);
  private readonly real = new Float64Array(FFT_SIZE);
  private readonly imaginary = new Float64Array(FFT_SIZE);
  private frames = 0;
  private column = 0;
  private nextBucket = 0;
  private activeBuckets: number[] = [];

  constructor(
    private readonly channels: number,
    private readonly totalFrames: number,
  ) {
    if ((channels !== 1 && channels !== 2) || !Number.isSafeInteger(totalFrames) || totalFrames <= 0) {
      throw new Error('Invalid audio analysis geometry.');
    }
    this.peaks = Array.from({ length: channels }, () => Array<number>(WAVEFORM_POINTS).fill(0));
  }

  consume(samples: Float32Array): void {
    if (samples.length % this.channels !== 0) {
      throw new Error('Incomplete analysis PCM frame.');
    }
    for (let offset = 0; offset < samples.length; offset += this.channels) {
      this.updateWaveformBuckets();
      let mono = 0;
      for (let channel = 0; channel < this.channels; channel++) {
        const input = samples[offset + channel]!;
        if (!Number.isFinite(input)) {
          throw new Error('Non-finite analysis PCM sample.');
        }
        // Preserve the existing signed s16 waveform convention, including -1.
        const value = Math.max(-32768, Math.min(32767, Math.round(input * 32768))) / 32768;
        for (const bucket of this.activeBuckets) {
          if (Math.abs(value) > Math.abs(this.peaks[channel]![bucket]!)) {
            this.peaks[channel]![bucket] = value;
          }
        }
        mono += input / this.channels;
      }
      this.ring[this.frames % FFT_SIZE] = mono;
      this.frames++;
      while (
        this.column < SPECTROGRAM_WIDTH &&
        this.frames >= Math.ceil(((this.column + 1) * this.totalFrames) / SPECTROGRAM_WIDTH)
      ) {
        this.drawColumn();
      }
    }
  }

  finish(): void {
    if (this.frames === 0) {
      throw new Error('Audio analysis produced no PCM.');
    }
    while (this.column < SPECTROGRAM_WIDTH) {
      this.drawColumn();
    }
    for (const channel of this.peaks) {
      for (let index = 0; index < channel.length; index++) {
        channel[index] = Math.round(channel[index]! * 10000) / 10000;
      }
    }
  }

  async png(): Promise<Blob> {
    const canvas = new OffscreenCanvas(SPECTROGRAM_WIDTH, SPECTROGRAM_HEIGHT);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Audio spectrogram canvas is unavailable.');
    }
    context.putImageData(new ImageData(this.pixels, SPECTROGRAM_WIDTH, SPECTROGRAM_HEIGHT), 0, 0);
    return canvas.convertToBlob({ type: 'image/png' });
  }

  private updateWaveformBuckets(): void {
    while (
      this.nextBucket < WAVEFORM_POINTS &&
      Math.floor((this.nextBucket * this.totalFrames) / WAVEFORM_POINTS) <= this.frames
    ) {
      this.activeBuckets.push(this.nextBucket++);
    }
    let activeCount = 0;
    for (const bucket of this.activeBuckets) {
      if (this.frames < Math.ceil(((bucket + 1) * this.totalFrames) / WAVEFORM_POINTS)) {
        this.activeBuckets[activeCount++] = bucket;
      }
    }
    this.activeBuckets.length = activeCount;
  }

  private drawColumn(): void {
    for (let i = 0; i < FFT_SIZE; i++) {
      const position = this.frames - FFT_SIZE + i;
      this.real[i] = (position < 0 ? 0 : this.ring[position % FFT_SIZE]!) * HANN[i]!;
      this.imaginary[i] = 0;
    }
    fft(this.real, this.imaginary);
    for (let row = 0; row < SPECTROGRAM_HEIGHT; row++) {
      const frequency =
        20 * (AUDIO_ANALYSIS_RATE / 2 / 20) ** ((SPECTROGRAM_HEIGHT - 1 - row) / (SPECTROGRAM_HEIGHT - 1));
      const bin = Math.min(FFT_SIZE / 2, Math.max(1, Math.round((frequency * FFT_SIZE) / AUDIO_ANALYSIS_RATE)));
      const magnitude = (Math.hypot(this.real[bin]!, this.imaginary[bin]!) * 4) / FFT_SIZE;
      const level = Math.max(0, Math.min(1, (20 * Math.log10(Math.max(1e-5, magnitude)) + 100) / 100));
      const colorPosition = level * (MAGMA.length - 1);
      const low = Math.min(MAGMA.length - 2, Math.floor(colorPosition));
      const fraction = colorPosition - low;
      const offset = (row * SPECTROGRAM_WIDTH + this.column) * 4;
      for (let component = 0; component < 3; component++) {
        this.pixels[offset + component] =
          MAGMA[low]![component]! * (1 - fraction) + MAGMA[low + 1]![component]! * fraction;
      }
      this.pixels[offset + 3] = 255;
    }
    this.column++;
  }
}

function fft(real: Float64Array, imaginary: Float64Array): void {
  const size = real.length;
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j]!, real[i]!];
    }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const stride = size / length;
    for (let start = 0; start < size; start += length) {
      for (let j = 0; j < length / 2; j++) {
        const even = start + j;
        const odd = even + length / 2;
        const cosine = COSINE[j * stride]!;
        const sine = SINE[j * stride]!;
        const rotatedReal = real[odd]! * cosine - imaginary[odd]! * sine;
        const rotatedImaginary = real[odd]! * sine + imaginary[odd]! * cosine;
        real[odd] = real[even]! - rotatedReal;
        imaginary[odd] = imaginary[even]! - rotatedImaginary;
        real[even] = real[even]! + rotatedReal;
        imaginary[even] = imaginary[even]! + rotatedImaginary;
      }
    }
  }
}
