import { describe, expect, it } from 'vitest';
import { getArtistImagePlaceholderMetrics } from './ArtistImageCropper';

describe('getArtistImagePlaceholderMetrics', () => {
  it('keeps the default artist upload surface tall enough for the upload copy', () => {
    expect(getArtistImagePlaceholderMetrics(100)).toEqual({
      width: 220,
      height: 144,
    });
  });

  it('scales up with larger preview sizes without shrinking below the readable floor', () => {
    expect(getArtistImagePlaceholderMetrics(140)).toEqual({
      width: 308,
      height: 184,
    });
  });

  it('preserves a readable minimum surface for smaller preview sizes', () => {
    expect(getArtistImagePlaceholderMetrics(64)).toEqual({
      width: 220,
      height: 144,
    });
  });
});
