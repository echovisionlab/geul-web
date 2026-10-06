import type { PercentCrop } from 'react-image-crop';

/** Correct the ratio without moving the selection or extending it beyond the image. */
export function clampToAspectRange(
  crop: PercentCrop,
  imageWidth: number,
  imageHeight: number,
  aspectRange: { min: number; max: number },
): PercentCrop {
  if (!crop.width || !crop.height) {
    return crop;
  }

  const width = (crop.width / 100) * imageWidth;
  const height = (crop.height / 100) * imageHeight;
  const aspect = width / height;
  if (aspect >= aspectRange.min && aspect <= aspectRange.max) {
    return crop;
  }

  const targetAspect = aspect < aspectRange.min ? aspectRange.min : aspectRange.max;
  const correctedHeight = Math.min(width / targetAspect, ((100 - crop.y) / 100) * imageHeight);
  return {
    ...crop,
    width: ((correctedHeight * targetAspect) / imageWidth) * 100,
    height: (correctedHeight / imageHeight) * 100,
  };
}
