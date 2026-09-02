import { describe, expect, it } from 'vitest';
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
