import { describe, expect, it } from 'vitest';
import { parseWorkMapProps } from './schema';

describe('parseWorkMapProps', () => {
  it.each([undefined, null, {}])('applies the shared contract defaults to stored props %j', (props) => {
    expect(parseWorkMapProps(props)).toEqual({
      workTypes: '',
      featuredOnly: 'false',
      sortBy: 'published_at',
      sortOrder: 'desc',
      aspectRatio: '16:9',
      displaySize: '100',
      minZoom: '-2',
      maxZoom: '22',
      primaryLabel: 'content_title',
      themeId: '',
      preferredScheme: 'auto',
      areaLabelsMode: 'inherit',
      poiLabelsMode: 'inherit',
    });
  });

  it('keeps zoom bounds at the edges of the supported -2 to 22 range', () => {
    expect(parseWorkMapProps({ minZoom: '-2', maxZoom: '22' })).toMatchObject({ minZoom: '-2', maxZoom: '22' });
  });

  it.each([{ minZoom: '-3' }, { maxZoom: '23' }, { maxZoom: '' }, { featuredOnly: 'yes' }, { poiLabelsMode: 'auto' }])(
    'rejects malformed stored props %j',
    (props) => {
      expect(() => parseWorkMapProps(props)).toThrow();
    },
  );
});
