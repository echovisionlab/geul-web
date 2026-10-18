import { describe, expect, it } from 'vitest';
import { parseWorkTableProps } from './schema';

describe('parseWorkTableProps', () => {
  it.each([undefined, null, {}])(
    'shows published Works with the shared contract defaults for stored props %j',
    (props) => {
      expect(parseWorkTableProps(props)).toEqual({
        workTypes: '',
        featuredOnly: 'false',
        statuses: 'WORK_STATUS_PUBLISHED',
        filterFields: 'type,featured,status,year,published_at',
        sortFields: 'published_at,updated_at,title',
        pageSize: '10',
      });
    },
  );

  it.each([{ featuredOnly: true }, { statuses: [] }, { pageSize: 25 }, { filterFields: null }])(
    'rejects malformed stored props %j',
    (props) => {
      expect(() => parseWorkTableProps(props)).toThrow();
    },
  );
});
