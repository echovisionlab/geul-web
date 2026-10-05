import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  init: vi.fn(),
  encode: vi.fn(),
  getImageData: vi.fn(),
  nativeType: 'image/webp',
}));
vi.mock('@jsquash/webp/encode.js', () => ({ init: runtime.init, default: runtime.encode }));

// Header-only codec boundary stub; these units do not verify image decoding.
function webpHeaderStub(): ArrayBuffer {
  return Uint8Array.from([
    0x52, 0x49, 0x46, 0x46, 12, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20, 0, 0, 0, 0,
  ]).buffer;
}

beforeEach(() => {
  vi.resetModules();
  runtime.init.mockReset().mockResolvedValue(undefined);
  runtime.encode.mockReset().mockImplementation(async () => webpHeaderStub());
  runtime.getImageData.mockReset().mockImplementation((_x, _y, width, height) => ({
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  }));
  runtime.nativeType = 'image/webp';
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      constructor(
        public width: number,
        public height: number,
      ) {}
      getContext = () => ({ getImageData: runtime.getImageData });
      convertToBlob = async () => new Blob([webpHeaderStub()], { type: runtime.nativeType });
    },
  );
});

async function prepare(width = 2, height = 2) {
  const helper = await import('./video-thumbnail');
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Test canvas context is missing.');
  }
  return { ...helper, canvas, context, signal: new AbortController().signal };
}

describe('video thumbnail codec boundary', () => {
  it('uses native WebP without loading WASM or allocating RGBA', async () => {
    const { encodeVideoThumbnail, canvas, context, signal } = await prepare();
    const result = await encodeVideoThumbnail(canvas, context, signal);
    expect(result.type).toBe('image/webp');
    expect(runtime.init).not.toHaveBeenCalled();
    expect(runtime.encode).not.toHaveBeenCalled();
    expect(runtime.getImageData).not.toHaveBeenCalled();
  });

  it('routes native PNG output to libwebp with original dimensions, q90 and same-origin assets', async () => {
    runtime.nativeType = 'image/png';
    const { encodeVideoThumbnail, canvas, context, signal, VIDEO_WEBP_CODEC_ASSET_PATH } = await prepare(3, 2);
    const result = await encodeVideoThumbnail(canvas, context, signal);
    expect(runtime.getImageData).toHaveBeenCalledWith(0, 0, 3, 2);
    expect(runtime.encode).toHaveBeenCalledWith(expect.objectContaining({ width: 3, height: 2 }), {
      quality: 90,
      lossless: 0,
      low_memory: 1,
      thread_level: 0,
    });
    const { locateFile } = runtime.init.mock.calls[0][0];
    expect(locateFile('webp_enc.wasm')).toBe(`${VIDEO_WEBP_CODEC_ASSET_PATH}webp_enc.wasm`);
    expect(locateFile('webp_enc_simd.wasm')).toBe(`${VIDEO_WEBP_CODEC_ASSET_PATH}webp_enc_simd.wasm`);
    expect(() => locateFile('../unexpected.wasm')).toThrow('Unexpected');
    expect(result.type).toBe('image/webp');
  });

  it('rejects unrelated MIME output instead of hiding a native type error', async () => {
    runtime.nativeType = 'image/jpeg';
    const { encodeVideoThumbnail, canvas, context, signal } = await prepare();
    await expect(encodeVideoThumbnail(canvas, context, signal)).rejects.toThrow('unexpected MIME');
    expect(runtime.init).not.toHaveBeenCalled();
  });

  it('rejects oversized RGBA before allocation or codec initialization', async () => {
    runtime.nativeType = 'image/png';
    const { encodeVideoThumbnail, canvas, context, signal } = await prepare(8192, 4097);
    await expect(encodeVideoThumbnail(canvas, context, signal)).rejects.toBeInstanceOf(RangeError);
    expect(runtime.init).not.toHaveBeenCalled();
    expect(runtime.getImageData).not.toHaveBeenCalled();
  });

  it('propagates WASM initialization and encoding failures as processing errors', async () => {
    runtime.nativeType = 'image/png';
    const { encodeVideoThumbnail, canvas, context, signal } = await prepare();
    const initializationFailure = new Error('WASM fetch failed');
    runtime.init.mockRejectedValueOnce(initializationFailure);
    await expect(encodeVideoThumbnail(canvas, context, signal)).rejects.toBe(initializationFailure);
    const encodingFailure = new Error('libwebp failed');
    runtime.encode.mockRejectedValueOnce(encodingFailure);
    await expect(encodeVideoThumbnail(canvas, context, signal)).rejects.toBe(encodingFailure);
  });

  it('rejects mislabeled bytes and inconsistent RIFF length', async () => {
    runtime.nativeType = 'image/png';
    const { encodeVideoThumbnail, canvas, context, signal } = await prepare();
    runtime.encode.mockResolvedValueOnce(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]).buffer);
    await expect(encodeVideoThumbnail(canvas, context, signal)).rejects.toThrow('invalid WebP');
    const wrongLength = new Uint8Array(webpHeaderStub());
    wrongLength[4] = 0;
    runtime.encode.mockResolvedValueOnce(wrongLength.buffer);
    await expect(encodeVideoThumbnail(canvas, context, signal)).rejects.toThrow('invalid WebP');
  });

  it('propagates cancellation before allocating RGBA and after synchronous WASM encoding', async () => {
    runtime.nativeType = 'image/png';
    const { encodeVideoThumbnail, canvas, context } = await prepare();
    const controller = new AbortController();
    const reason = new DOMException('Canceled', 'AbortError');
    controller.abort(reason);
    await expect(encodeVideoThumbnail(canvas, context, controller.signal)).rejects.toBe(reason);
    expect(runtime.init).not.toHaveBeenCalled();
    const inFlight = new AbortController();
    runtime.encode.mockImplementationOnce(async () => {
      inFlight.abort(reason);
      return webpHeaderStub();
    });
    await expect(encodeVideoThumbnail(canvas, context, inFlight.signal)).rejects.toBe(reason);
  });
});
