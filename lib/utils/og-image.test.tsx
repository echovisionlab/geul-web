import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTENT_OG_CONFIG } from './og-config';
import { generateOgImage } from './og-image';

describe('OG image template', () => {
  it('renders the configured fallback as an opaque canvas', async () => {
    const buffer = await generateOgImage(
      '',
      { siteTitle: '', primaryColor: '#b02d23' },
      { ...DEFAULT_CONTENT_OG_CONFIG, darkBackground: '#123456' },
    );
    const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => {
      const offset = (y * info.width + x) * info.channels;
      return Array.from(data.subarray(offset, offset + info.channels));
    };

    expect(info.channels).toBe(3);
    expect(pixel(0, 0)).toEqual([18, 52, 86]);
    expect(pixel(600, 315)).toEqual([18, 52, 86]);
    expect(pixel(1199, 629)).toEqual([18, 52, 86]);
  });
});
