import { describe, expect, it } from 'vitest';
import { parseReleaseListProps } from './schema';

describe('parseReleaseListProps', () => {
  it.each([undefined, null, {}])('applies the shared contract defaults to stored props %j', (props) => {
    expect(parseReleaseListProps(props)).toEqual({
      layout: 'grid',
      itemSize: 'm',
      columns: '4',
      types: '',
      categoryIds: '',
      artistId: '',
      labelId: '',
      sortBy: 'release_date',
      sortOrder: 'desc',
      limit: '8',
      showPagination: 'false',
      showImage: 'true',
      showMeta: 'true',
      imageAspectRatio: '1:1',
      carouselLoop: 'true',
      carouselIndicators: 'true',
    });
  });

  it.each([{ sortBy: 'popularity' }, { imageAspectRatio: '3:2' }, { types: ['album'] }, { showPagination: true }])(
    'rejects malformed stored props %j',
    (props) => {
      expect(() => parseReleaseListProps(props)).toThrow();
    },
  );
});
