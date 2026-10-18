import { describe, expect, it } from 'vitest';
import { parsePostMapProps } from './schema';

describe('parsePostMapProps', () => {
  it.each([undefined, null, {}])('applies the shared contract defaults to stored props %j', (props) => {
    expect(parsePostMapProps(props)).toEqual({
      categoryIds: '',
      tagIds: '',
      authorIds: '',
      seriesId: '',
      requirePlace: 'true',
      sortBy: 'published_at',
      sortOrder: 'desc',
      aspectRatio: '16:9',
      previewWidth: '100',
      minZoom: '-2',
      maxZoom: '22',
      primaryLabel: 'content_title',
      themeId: '',
      preferredScheme: 'auto',
      areaLabelsMode: 'inherit',
      poiLabelsMode: 'inherit',
    });
  });

  it('keeps zoom bounds at and inside the supported -2 to 22 range', () => {
    expect(parsePostMapProps({ minZoom: '-2', maxZoom: '22' })).toMatchObject({ minZoom: '-2', maxZoom: '22' });
    expect(parsePostMapProps({ minZoom: '3', maxZoom: '18.5' })).toMatchObject({ minZoom: '3', maxZoom: '18.5' });
  });

  it.each([
    { minZoom: '-2.5' },
    { maxZoom: '22.5' },
    { maxZoom: 'abc' },
    { minZoom: '' },
    { minZoom: 3 },
    { primaryLabel: 'title' },
    { areaLabelsMode: 'auto' },
    { requirePlace: false },
  ])('rejects malformed stored props %j', (props) => {
    expect(() => parsePostMapProps(props)).toThrow();
  });
});
