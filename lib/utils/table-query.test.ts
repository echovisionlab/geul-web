import { describe, expect, it } from 'vitest';
import { filterSpecSchema, sortSpecSchema, tableQuerySchema } from './table-query';

describe('table query schema compatibility', () => {
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
