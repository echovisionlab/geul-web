import { isHeicInputMime } from '@/lib/types/upload/model';
import { canonicalizeMimeType } from '@/lib/utils/mime';

const CONVERT_TO_WEBP_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const TRUE_PASSTHROUGH_TYPES = ['image/gif', 'image/svg+xml'];
const HEIC_FILE_EXTENSIONS = new Set(['heic', 'heif']);
const HEIC_BRANDS = new Set(['mif1', 'msf1', 'heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs']);

const MAX_DIMENSION = 7680;
const DEFAULT_QUALITY = 1.0;
const DEFAULT_MIN_QUALITY = 0.56;
const DEFAULT_QUALITY_STEP = 0.08;
const DEFAULT_FALLBACK_SCALE = 0.85;
const MIN_REENCODE_DIMENSION = 512;

interface ConvertToWebPOptions {
  maxDimension?: number;
  maxBytes?: number;
  quality?: number;
  minQuality?: number;
  qualityStep?: number;
  fallbackScale?: number;
}

type CanvasLike = OffscreenCanvas | HTMLCanvasElement;

export function isHeicImageFile(file: Pick<File, 'name' | 'type'>): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return isHeicInputMime(canonicalizeMimeType(file.type)) || (extension != null && HEIC_FILE_EXTENSIONS.has(extension));
}

async function hasHeicBrand(file: File): Promise<boolean> {
  if (file.size < 16) {
    return false;
  }

  const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, 64)).arrayBuffer());
  const decoder = new TextDecoder('ascii');
  if (decoder.decode(bytes.subarray(4, 8)) !== 'ftyp') {
    return false;
  }

  const boxSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  const brandEnd = Math.min(bytes.byteLength, boxSize >= 16 ? boxSize : bytes.byteLength);
  if (HEIC_BRANDS.has(decoder.decode(bytes.subarray(8, 12)))) {
    return true;
  }
  for (let offset = 16; offset + 4 <= brandEnd; offset += 4) {
    if (HEIC_BRANDS.has(decoder.decode(bytes.subarray(offset, offset + 4)))) {
      return true;
    }
  }
  return false;
}

async function decodeImageBitmap(file: File, heicInput: boolean): Promise<ImageBitmap> {
  if (!heicInput) {
    return createImageBitmap(file);
  }

  if (!(await hasHeicBrand(file))) {
    throw new Error('Selected file is not a valid HEIC or HEIF image.');
  }

  const { heicTo } = await import('heic-to/next');
  return heicTo({
    blob: file,
    type: 'bitmap',
    options: { imageOrientation: 'from-image' },
  });
}

function createCanvas(width: number, height: number): CanvasLike {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function canvasToBlob(canvas: CanvasLike, quality: number): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({
      type: 'image/webp',
      quality,
    });
  }

  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob: Blob | null) => {
        if (!blob) {
          reject(new Error('Failed to encode image as WebP'));
          return;
        }

        resolve(blob);
      },
      'image/webp',
      quality,
    );
  });
}

function getScaledDimensions(width: number, height: number, maxDimension: number): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const scale = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function renderBitmapToWebP(bitmap: ImageBitmap, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) {
    throw new Error('Failed to get 2d context for image conversion');
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvasToBlob(canvas, quality);
}

/**
 * Converts an image file to WebP format with optional resizing and byte caps.
 */
export async function convertToWebP(file: File, options: ConvertToWebPOptions = {}): Promise<File> {
  const {
    maxDimension = MAX_DIMENSION,
    maxBytes,
    quality: initialQuality = DEFAULT_QUALITY,
    minQuality = DEFAULT_MIN_QUALITY,
    qualityStep = DEFAULT_QUALITY_STEP,
    fallbackScale = DEFAULT_FALLBACK_SCALE,
  } = options;

  const canonicalType = canonicalizeMimeType(file.type);
  const heicInput = isHeicImageFile(file);

  if (TRUE_PASSTHROUGH_TYPES.includes(canonicalType)) {
    return file;
  }

  if (!heicInput && !CONVERT_TO_WEBP_TYPES.includes(canonicalType)) {
    return file;
  }

  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await decodeImageBitmap(file, heicInput);
    const sourceBitmap = bitmap;

    const scaled = getScaledDimensions(sourceBitmap.width, sourceBitmap.height, maxDimension);
    let width = scaled.width;
    let height = scaled.height;

    if (
      canonicalType === 'image/webp' &&
      width === sourceBitmap.width &&
      height === sourceBitmap.height &&
      (maxBytes == null || file.size <= maxBytes)
    ) {
      return file;
    }

    const encode = async (quality: number): Promise<Blob> => renderBitmapToWebP(sourceBitmap, width, height, quality);

    let quality = initialQuality;
    let blob = await encode(quality);

    if (maxBytes != null) {
      while (blob.size > maxBytes && quality - qualityStep >= minQuality) {
        quality = Math.max(minQuality, quality - qualityStep);
        blob = await encode(quality);
      }

      while (blob.size > maxBytes && Math.max(width, height) > MIN_REENCODE_DIMENSION) {
        width = Math.max(MIN_REENCODE_DIMENSION, Math.round(width * fallbackScale));
        height = Math.max(MIN_REENCODE_DIMENSION, Math.round(height * fallbackScale));
        quality = initialQuality;
        blob = await encode(quality);

        while (blob.size > maxBytes && quality - qualityStep >= minQuality) {
          quality = Math.max(minQuality, quality - qualityStep);
          blob = await encode(quality);
        }
      }
    }

    return new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
      type: 'image/webp',
    });
  } catch (error) {
    if (heicInput) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to decode HEIC or HEIF image: ${detail}`);
    }
    return file;
  } finally {
    bitmap?.close();
  }
}
