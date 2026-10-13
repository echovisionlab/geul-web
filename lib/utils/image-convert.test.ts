import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToWebP, isHeicImageFile } from './image-convert';

describe('image-convert HEIC detection', () => {
  it('recognizes HEIC and HEIF from MIME or filename', () => {
    expect(isHeicImageFile({ name: 'photo.bin', type: 'image/heic' })).toBe(true);
    expect(isHeicImageFile({ name: 'photo.HEIF', type: '' })).toBe(true);
    expect(isHeicImageFile({ name: 'photo.jpg', type: 'image/jpeg' })).toBe(false);
  });

  it('rejects a fake HEIC file before loading the decoder', async () => {
    const file = new File([new Uint8Array(16)], 'fake.heic', { type: 'image/heic' });
    await expect(convertToWebP(file)).rejects.toThrow('not a valid HEIC or HEIF image');
  });
});

describe('managed raster preparation failure', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects failed decoding in strict mode instead of passing through a large original', async () => {
    const source = new File(['not-an-image'], 'broken.png', { type: 'image/png' });
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('Cannot decode image')));
    await expect(
      convertToWebP(source, { strict: true, maxDimension: 4096, maxBytes: 30 * 1024 * 1024 }),
    ).rejects.toThrow('Cannot decode image');
    await expect(convertToWebP(source)).resolves.toBe(source);
  });

  it('resizes and encodes a large decoded source before releasing its bitmap', async () => {
    const close = vi.fn();
    const drawImage = vi.fn();
    const convertToBlob = vi.fn().mockResolvedValue(new Blob(['prepared'], { type: 'image/webp' }));
    const dimensions: number[] = [];
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 8192, height: 6144, close }));
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        constructor(width: number, height: number) {
          dimensions.push(width, height);
        }
        getContext() {
          return { drawImage };
        }
        convertToBlob = convertToBlob;
      },
    );
    const output = await convertToWebP(new File(['original'], 'photo.png', { type: 'image/png' }), {
      strict: true,
      maxDimension: 4096,
      maxBytes: 30 * 1024 * 1024,
    });
    expect(dimensions).toEqual([4096, 3072]);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 4096, 3072);
    expect(output.type).toBe('image/webp');
    expect(output.name).toBe('photo.webp');
    expect(close).toHaveBeenCalledOnce();
  });
});
