import { describe, expect, it } from 'vitest';
import { parsePostListProps } from './schema';

describe('parsePostListProps', () => {
  it.each([undefined, null, {}])('applies the shared contract defaults to stored props %j', (props) => {
    expect(parsePostListProps(props)).toEqual({
      layout: 'grid',
      itemSize: 'm',
      columns: '3',
      categoryIds: '',
      tagIds: '',
      authorIds: '',
      seriesId: '',
      sortBy: 'published_at',
      sortOrder: 'desc',
      limit: '6',
      showPagination: 'false',
      showFeaturedImage: 'true',
      showMeta: 'true',
      imageAspectRatio: '16:9',
      carouselLoop: 'true',
      carouselIndicators: 'true',
    });
  });

  it.each([{ sortBy: 'views' }, { layout: 'masonry' }, { limit: 6 }, { showFeaturedImage: false }])(
    'rejects malformed stored props %j',
    (props) => {
      expect(() => parsePostListProps(props)).toThrow();
    },
  );
});
