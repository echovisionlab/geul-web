// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cropImage } from './image-crop';

const drawImage = vi.fn();
let encodedCanvas: { width: number; height: number; type?: string; quality?: number } | null;

function imageFixture(naturalWidth: number, naturalHeight: number): HTMLImageElement {
  return {
    naturalWidth,
    naturalHeight,
    width: naturalWidth,
    height: naturalHeight,
  } as HTMLImageElement;
}

beforeEach(() => {
  encodedCanvas = null;
  drawImage.mockReset();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback,
    type,
    quality,
  ) {
    encodedCanvas = { width: this.width, height: this.height, type, quality };
    callback(new Blob(['encoded'], { type }));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cropImage output bounds', () => {
  it('downscales a large crop to the requested dimensions', async () => {
    await cropImage({
      image: imageFixture(4000, 3000),
      crop: { unit: '%', x: 0, y: 0, width: 100, height: 100 },
      format: 'webp',
      quality: 0.85,
      maxWidth: 1024,
      maxHeight: 1024,
    });

    expect(encodedCanvas).toEqual({
      width: 1024,
      height: 768,
      type: 'image/webp',
      quality: 0.85,
    });
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 4000, 3000, 0, 0, 1024, 768);
  });

  it('never upscales a crop smaller than the output bound', async () => {
    await cropImage({
      image: imageFixture(500, 400),
      crop: { unit: '%', x: 0, y: 0, width: 100, height: 100 },
      format: 'webp',
      quality: 0.85,
      maxWidth: 1024,
      maxHeight: 1024,
    });

    expect(encodedCanvas).toMatchObject({ width: 500, height: 400 });
  });
});
