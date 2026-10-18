import { describe, expect, it } from 'vitest';
import { parseArtistListProps } from './schema';

describe('parseArtistListProps', () => {
  it.each([undefined, null, {}])('applies the shared contract defaults to stored props %j', (props) => {
    expect(parseArtistListProps(props)).toEqual({
      layout: 'grid',
      itemSize: 'm',
      columns: '3',
      labelIds: '',
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

  it.each([
    { layout: 'masonry' },
    { sortBy: 'popularity' },
    { imageAspectRatio: '3:2' },
    { showMeta: true },
    { columns: 4 },
  ])('rejects malformed stored props %j', (props) => {
    expect(() => parseArtistListProps(props)).toThrow();
  });
});
