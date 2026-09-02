import { describe, expect, it } from 'vitest';
import { buildPublicTableRequest, InvalidPublicTableQueryError } from './public-table';

describe('buildPublicTableRequest', () => {
  it('rejects unsupported filter fields when strict validation is enabled', () => {
    expect(() =>
      buildPublicTableRequest({
        query: {
          page: 1,
          pageSize: 10,
          filters: [
            {
              field: 'author_id',
              op: 'in',
              value: ['user-1'],
            },
          ],
        },
        defaultPageSize: 10,
        allowedFilterFields: [{ field: 'status', operators: ['in'] }],
        allowedSortFields: [{ field: 'published_at' }],
        rejectInvalidQuery: true,
      }),
    ).toThrow(InvalidPublicTableQueryError);
  });

  it('rejects unsupported sort fields when strict validation is enabled', () => {
    expect(() =>
      buildPublicTableRequest({
        query: {
          page: 1,
          pageSize: 10,
          sorts: [
            {
              field: 'updated_at',
              direction: 'desc',
            },
          ],
        },
        defaultPageSize: 10,
        allowedFilterFields: [{ field: 'status', operators: ['in'] }],
        allowedSortFields: [{ field: 'published_at' }],
        rejectInvalidQuery: true,
      }),
    ).toThrow(InvalidPublicTableQueryError);
  });
});
