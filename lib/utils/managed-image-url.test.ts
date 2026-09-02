import { describe, expect, it, vi } from 'vitest';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET, resolveManagedImageBucketWidth } from './managed-image-url';

vi.mock('../public-runtime-config', () => ({
  getPublicCdnUrl: () => 'https://cdn.example.test',
}));

describe('managed-image-url', () => {
  describe('resolveManagedImageBucketWidth', () => {
    it('rounds widths up to the next canonical bucket', () => {
      expect(resolveManagedImageBucketWidth(81)).toBe(96);
      expect(resolveManagedImageBucketWidth(161)).toBe(192);
      expect(resolveManagedImageBucketWidth(1600)).toBe(1600);
    });
  });

  describe('buildManagedImageUrl', () => {
    it('builds a canonical CDN URL for a relative managed raster asset', () => {
      expect(
        buildManagedImageUrl('/asset/11111111-1111-4111-8111-111111111111/image.webp', MANAGED_IMAGE_PRESET.AVATAR_SM),
      ).toBe('https://cdn.example.test/asset/11111111-1111-4111-8111-111111111111/image.webp?w=96&h=96&fit=fill&q=80');
    });

    it('preserves managed URL query params while overwriting transform params', () => {
      expect(
        buildManagedImageUrl(
          'https://cdn.example.test/asset/22222222-2222-4222-8222-222222222222/image.webp?w=48',
          MANAGED_IMAGE_PRESET.COVER_CARD,
        ),
      ).toBe(
        'https://cdn.example.test/asset/22222222-2222-4222-8222-222222222222/image.webp?w=640&h=640&fit=fill&q=80',
      );
    });

    it('passes external URLs through unchanged', () => {
      expect(buildManagedImageUrl('https://images.example.test/photo.jpg', MANAGED_IMAGE_PRESET.HEADER_IMAGE)).toBe(
        'https://images.example.test/photo.jpg',
      );
    });

    it('bypasses managed svg transforms while normalizing relative CDN paths', () => {
      expect(
        buildManagedImageUrl(
          '/asset/33333333-3333-4333-8333-333333333333/image.svg',
          MANAGED_IMAGE_PRESET.HEADER_IMAGE,
        ),
      ).toBe('https://cdn.example.test/asset/33333333-3333-4333-8333-333333333333/image.svg');
    });

    it('bypasses managed gif transforms', () => {
      expect(
        buildManagedImageUrl(
          'https://cdn.example.test/asset/44444444-4444-4444-8444-444444444444/image.gif',
          MANAGED_IMAGE_PRESET.HERO_IMAGE,
        ),
      ).toBe('https://cdn.example.test/asset/44444444-4444-4444-8444-444444444444/image.gif');
    });
  });
});
