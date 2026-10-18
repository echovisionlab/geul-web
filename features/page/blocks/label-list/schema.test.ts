import { describe, expect, it } from 'vitest';
import { parseLabelListProps } from './schema';

describe('parseLabelListProps', () => {
  it.each([undefined, null, {}])('applies the shared contract defaults to stored props %j', (props) => {
    expect(parseLabelListProps(props)).toEqual({
      layout: 'grid',
      itemSize: 'm',
      columns: '3',
      sortBy: 'name',
      sortOrder: 'asc',
      limit: '12',
      showPagination: 'false',
      showImage: 'true',
      showMeta: 'true',
      imageAspectRatio: '1:1',
      carouselLoop: 'true',
      carouselIndicators: 'true',
    });
  });

  it.each([{ sortOrder: 'random' }, { sortBy: 'title' }, { showImage: false }, { limit: 3 }])(
    'rejects malformed stored props %j',
    (props) => {
      expect(() => parseLabelListProps(props)).toThrow();
    },
  );
});
