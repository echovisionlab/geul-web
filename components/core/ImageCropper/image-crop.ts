/**
 * Image Cropping Utility
 *
 * Outputs cropped images at natural size unless an explicit output bound is provided.
 * Supports both PercentCrop and PixelCrop from react-image-crop.
 */

import type { PercentCrop, PixelCrop } from 'react-image-crop';

export interface CropOptions {
  /** The source image element */
  image: HTMLImageElement;
  /** The crop region (either PercentCrop or PixelCrop) */
  crop: PercentCrop | PixelCrop;
  /** Output format */
  format: 'jpeg' | 'png' | 'webp';
  /** Quality (0-1, for JPEG/WebP). Default is 1.0. */
  quality?: number;
  /** Maximum output width. The crop is never upscaled. */
  maxWidth?: number;
  /** Maximum output height. The crop is never upscaled. */
  maxHeight?: number;
}

interface PixelCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Determines if crop is in percent units.
 */
function isPercentCrop(crop: PercentCrop | PixelCrop): crop is PercentCrop {
  return crop.unit === '%';
}

/**
 * Converts any crop to pixel values.
 */
function toPixelCrop(
  crop: PercentCrop | PixelCrop,
  imageWidth: number,
  imageHeight: number,
  displayWidth: number,
  displayHeight: number,
): PixelCropRect {
  if (isPercentCrop(crop)) {
    // PercentCrop: values are percentages of natural image dimensions
    return {
      x: ((crop.x ?? 0) / 100) * imageWidth,
      y: ((crop.y ?? 0) / 100) * imageHeight,
      width: ((crop.width ?? 0) / 100) * imageWidth,
      height: ((crop.height ?? 0) / 100) * imageHeight,
    };
  }

  // PixelCrop: values are in display pixels, need to scale to natural pixels
  const scaleX = imageWidth / displayWidth;
  const scaleY = imageHeight / displayHeight;

  return {
    x: (crop.x ?? 0) * scaleX,
    y: (crop.y ?? 0) * scaleY,
    width: (crop.width ?? 0) * scaleX,
    height: (crop.height ?? 0) * scaleY,
  };
}

/**
 * Crop an image to the specified region and return as a Blob.
 * Outputs at natural crop size unless bounded, preserving aspect ratio without upscaling.
 *
 * @example
 * ```ts
 * const blob = await cropImage({
 *   image: imgRef.current,
 *   crop: completedCrop,
 *   format: 'webp',
 * });
 * ```
 */
export async function cropImage(options: CropOptions): Promise<Blob | null> {
  const { image, crop, format, quality = 1.0, maxWidth, maxHeight } = options;

  if (!image || !crop) {
    return null;
  }

  const canvas = document.createElement('canvas');

  // Convert crop to natural pixel coordinates
  const pixelCrop = toPixelCrop(crop, image.naturalWidth, image.naturalHeight, image.width, image.height);

  if (pixelCrop.width <= 0 || pixelCrop.height <= 0) {
    return null;
  }

  const widthScale = maxWidth && maxWidth > 0 ? maxWidth / pixelCrop.width : 1;
  const heightScale = maxHeight && maxHeight > 0 ? maxHeight / pixelCrop.height : 1;
  const outputScale = Math.min(1, widthScale, heightScale);
  canvas.width = Math.max(1, Math.round(pixelCrop.width * outputScale));
  canvas.height = Math.max(1, Math.round(pixelCrop.height * outputScale));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    const mimeType = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
    const outputQuality = format === 'png' ? 1 : quality;
    canvas.toBlob((blob) => resolve(blob), mimeType, outputQuality);
  });
}
