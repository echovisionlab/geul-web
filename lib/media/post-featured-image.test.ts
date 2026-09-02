import type { MediaDelivery } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { describe, expect, it } from 'vitest';
import { assetRefFixture } from '@/tests/helpers/asset-ref';
import { resolveFeaturedImageDeliveryUrl, resolvePostFeaturedImageUrl } from './post-featured-image';

describe('resolvePostFeaturedImageUrl', () => {
  it('prefers the immutable thumbnail and falls back through the delivery contract', () => {
    expect(
      resolvePostFeaturedImageUrl({
        thumbnail: assetRefFixture('https://cdn.example/thumbnail.webp'),
        asset: assetRefFixture('https://cdn.example/asset.webp'),
      } as MediaDelivery),
    ).toBe('https://cdn.example/thumbnail.webp');

    expect(
      resolvePostFeaturedImageUrl({
        inline: { url: 'https://signed.example/inline' },
      } as MediaDelivery),
    ).toBe('https://signed.example/inline');
    expect(resolvePostFeaturedImageUrl()).toBeNull();
  });

  it('exposes the same resolver for non-Post content domains', () => {
    expect(
      resolveFeaturedImageDeliveryUrl({
        thumbnail: assetRefFixture('https://cdn.example/page-thumbnail.webp'),
      } as MediaDelivery),
    ).toBe('https://cdn.example/page-thumbnail.webp');
  });
});
