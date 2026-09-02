import type { FilterOperator } from '@/lib/types/common/filter';

export type FilterOperatorMessageKey =
  | 'eq'
  | 'ne'
  | 'isNull'
  | 'isNullNegated'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'like'
  | 'ilike'
  | 'startsWith'
  | 'endsWith'
  | 'fulltext'
  | 'in'
  | 'contains'
  | 'containedBy'
  | 'overlaps'
  | 'isEmpty'
  | 'isEmptyNegated'
  | 'jsonContains'
  | 'hasKey'
  | 'hasAnyKey';

export function getFilterOperatorMessageKey(op: FilterOperator, negated = false): FilterOperatorMessageKey {
  switch (op) {
    case 'eq':
      return 'eq';
    case 'ne':
      return 'ne';
    case 'isNull':
      return negated ? 'isNullNegated' : 'isNull';
    case 'gt':
      return 'gt';
    case 'gte':
      return 'gte';
    case 'lt':
      return 'lt';
    case 'lte':
      return 'lte';
    case 'between':
      return 'between';
    case 'like':
      return 'like';
    case 'ilike':
      return 'ilike';
    case 'startsWith':
      return 'startsWith';
    case 'endsWith':
      return 'endsWith';
    case 'fulltext':
      return 'fulltext';
    case 'in':
      return 'in';
    case 'contains':
      return 'contains';
    case 'containedBy':
      return 'containedBy';
    case 'overlaps':
      return 'overlaps';
    case 'isEmpty':
      return negated ? 'isEmptyNegated' : 'isEmpty';
    case 'jsonContains':
      return 'jsonContains';
    case 'hasKey':
      return 'hasKey';
    case 'hasAnyKey':
      return 'hasAnyKey';
    default:
      return 'eq';
  }
}
