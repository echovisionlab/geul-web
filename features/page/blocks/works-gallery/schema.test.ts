import { describe, expect, it } from 'vitest';
import { parseWorkListProps } from './schema';

describe('parseWorkListProps', () => {
  it.each([undefined, null, {}])('applies the shared contract defaults to stored props %j', (props) => {
    expect(parseWorkListProps(props)).toEqual({
      layout: 'grid',
      itemSize: 'm',
      columns: '3',
      workTypes: '',
      featuredOnly: 'false',
      sortBy: 'published_at',
      sortOrder: 'desc',
      limit: '6',
      showPagination: 'false',
      showImage: 'true',
      showMeta: 'true',
      imageAspectRatio: '16:9',
      carouselLoop: 'true',
      carouselIndicators: 'true',
    });
  });

  it.each([{ sortBy: 'year' }, { layout: 'masonry' }, { carouselLoop: false }, { featuredOnly: 'yes' }])(
    'rejects malformed stored props %j',
    (props) => {
      expect(() => parseWorkListProps(props)).toThrow();
    },
  );
});
