import { describe, expect, it } from 'vitest';
import { toPaginatedListInput, type PaginatedQuery } from './query';

describe('toPaginatedListInput', () => {
  it('maps a table query change to the list action input', () => {
    const filters: PaginatedQuery['filters'] = [{ field: 'name', op: 'ilike', value: 'mina' }];

    expect(
      toPaginatedListInput({
        page: 3,
        pageSize: 10,
        search: 'mina',
        filterBy: 'OR',
        filters,
        sorts: [
          { field: 'created_at', direction: 'desc' },
          { field: 'name', direction: 'asc' },
        ],
      }),
    ).toEqual({
      filter: filters,
      filterBy: 'OR',
      sort: [
        { field: 'created_at', order: 'desc' },
        { field: 'name', order: 'asc' },
      ],
      page: 3,
      pageSize: 10,
      search: 'mina',
    });
  });

  it('requests the first page of 20 rows and leaves unset criteria for the action to default', () => {
    expect(toPaginatedListInput({})).toEqual({
      filter: undefined,
      filterBy: undefined,
      sort: undefined,
      page: 1,
      pageSize: 20,
      search: undefined,
    });
  });
});
