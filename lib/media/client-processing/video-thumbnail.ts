/// <reference types="@jsquash/webp/emscripten-types" />

/** Same-origin assets copied from the pinned @jsquash/webp 1.5.0 package at build time. */
export const VIDEO_WEBP_CODEC_ASSET_PATH = '/client-media/codecs/webp-1.5.0/';
const MAX_THUMBNAIL_PIXELS = 32 * 1024 * 1024;
const MAX_RGBA_BYTES = 128 * 1024 * 1024;
let encoderReady: Promise<typeof import('@jsquash/webp/encode.js')> | undefined;

async function getWebpEncoder() {
  if (!encoderReady) {
    encoderReady = (async () => {
      const encoder = await import('@jsquash/webp/encode.js');
      await encoder.init({
        locateFile: (filename: string) => {
          if (filename !== 'webp_enc.wasm' && filename !== 'webp_enc_simd.wasm') {
            throw new Error('Unexpected video thumbnail codec asset.');
          }
          return `${VIDEO_WEBP_CODEC_ASSET_PATH}${filename}`;
        },
      });
      return encoder;
    })().catch((error) => {
      encoderReady = undefined;
      throw error;
    });
  }
  return encoderReady;
}

function hasTag(bytes: Uint8Array, offset: number, tag: string): boolean {
  return [...tag].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

async function verifyWebp(blob: Blob): Promise<void> {
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (
    header.length !== 12 ||
    !hasTag(header, 0, 'RIFF') ||
    !hasTag(header, 8, 'WEBP') ||
    new DataView(header.buffer).getUint32(4, true) + 8 !== blob.size
  ) {
    throw new Error('Video thumbnail encoder returned invalid WebP data.');
  }
}

function checkDimensions(canvas: OffscreenCanvas): number {
  const pixels = canvas.width * canvas.height;
  if (
    !Number.isSafeInteger(pixels) ||
    canvas.width <= 0 ||
    canvas.height <= 0 ||
    pixels > MAX_THUMBNAIL_PIXELS ||
    pixels * 4 > MAX_RGBA_BYTES
  ) {
    throw new RangeError('Video thumbnail exceeds the 32 MiPixel / 128 MiB RGBA limit.');
  }
  return pixels;
}

async function encodeRgba(
  canvas: OffscreenCanvas,
  context: OffscreenCanvasRenderingContext2D,
  pixels: number,
  signal: AbortSignal,
): Promise<Blob> {
  const encoder = await getWebpEncoder();
  signal.throwIfAborted();
  // Allocate one source-sized RGBA image, never all video frames or the source file.
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  if (image.width !== canvas.width || image.height !== canvas.height || image.data.byteLength !== pixels * 4) {
    throw new Error('Video thumbnail canvas returned inconsistent RGBA dimensions.');
  }
  const encoded = await encoder.default(image, { quality: 90, lossless: 0, low_memory: 1, thread_level: 0 });
  signal.throwIfAborted();
  return new Blob([encoded], { type: 'image/webp' });
}

/** Preserve native WebP where available; Safari's PNG result uses bounded client-side libwebp. */
export async function encodeVideoThumbnail(
  canvas: OffscreenCanvas,
  context: OffscreenCanvasRenderingContext2D,
  signal: AbortSignal,
): Promise<Blob> {
  signal.throwIfAborted();
  const pixels = checkDimensions(canvas);
  let blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.9 });
  signal.throwIfAborted();
  if (blob.type === 'image/png') {
    blob = await encodeRgba(canvas, context, pixels, signal);
  } else if (blob.type !== 'image/webp') {
    throw new Error(`Video thumbnail canvas returned an unexpected MIME type: ${blob.type}.`);
  }
  await verifyWebp(blob);
  signal.throwIfAborted();
  return blob;
}
