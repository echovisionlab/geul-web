import { describe, expect, it } from 'vitest';
import { parseProgramEventListProps } from './schema';

describe('parseProgramEventListProps', () => {
  it.each([undefined, null, {}])('applies the shared contract defaults to stored props %j', (props) => {
    expect(parseProgramEventListProps(props)).toEqual({
      layout: 'grid',
      itemSize: 'm',
      columns: '3',
      typeIds: '',
      seriesId: '',
      timeWindow: 'all',
      sortBy: 'starts_at',
      sortOrder: 'asc',
      limit: '6',
      showPagination: 'false',
      showImage: 'true',
      showMeta: 'true',
      imageAspectRatio: '16:9',
      carouselLoop: 'true',
      carouselIndicators: 'true',
    });
  });

  it.each([{ timeWindow: 'future' }, { sortBy: 'created_at' }, { carouselLoop: true }, { typeIds: ['a'] }])(
    'rejects malformed stored props %j',
    (props) => {
      expect(() => parseProgramEventListProps(props)).toThrow();
    },
  );
});
