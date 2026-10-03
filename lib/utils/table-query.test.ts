import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, filterSpecSchema, sortSpecSchema, tableQuerySchema } from './table-query';
import * as defaults from './table-query-defaults';

describe('table query schema compatibility', () => {
  it('retains original constant exports and schema defaults', () => {
    expect(DEFAULT_PAGE).toBe(defaults.DEFAULT_PAGE);
    expect(DEFAULT_PAGE_SIZE).toBe(defaults.DEFAULT_PAGE_SIZE);
    expect(tableQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('keeps bounds and fluent schema composition', () => {
    expect(tableQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(tableQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
    expect(tableQuerySchema.partial().parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(tableQuerySchema.pick({ page: true }).parse({ page: 2 })).toEqual({ page: 2 });
  });

  it('retains sort and filter validation with arbitrary filter values', () => {
    expect(sortSpecSchema.parse({ field: 'name', direction: 'asc' })).toEqual({ field: 'name', direction: 'asc' });
    expect(sortSpecSchema.safeParse({ field: 'name', direction: 'invalid' }).success).toBe(false);
    expect(filterSpecSchema.parse({ field: 'country', op: 'in', value: ['KR'] })).toEqual({
      field: 'country',
      op: 'in',
      value: ['KR'],
    });
  });
});
