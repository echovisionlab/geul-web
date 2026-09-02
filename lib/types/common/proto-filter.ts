import { FilterOp } from '@echovisionlab/geul-proto/common/common_pb.ts';

export function filterOpFromString(op: string, value: unknown): FilterOp | null {
  switch (op) {
    case 'eq':
      return FilterOp.EQ;
    case 'ne':
      return FilterOp.NEQ;
    case 'gt':
      return FilterOp.GT;
    case 'gte':
      return FilterOp.GTE;
    case 'lt':
      return FilterOp.LT;
    case 'lte':
      return FilterOp.LTE;
    case 'like':
      return FilterOp.LIKE;
    case 'ilike':
    case 'startsWith':
    case 'endsWith':
    case 'fulltext':
      return FilterOp.ILIKE;
    case 'in':
      return FilterOp.IN;
    case 'isNull':
      return value === false ? FilterOp.IS_NOT_NULL : FilterOp.IS_NULL;
    default:
      return null;
  }
}
