// === Operator Classifications ===

/** Base operators available for all types */
export type BaseOp = 'eq' | 'ne' | 'isNull';

/** Comparison operators for numeric and date types */
export type CompareOp = 'gt' | 'gte' | 'lt' | 'lte' | 'between';

/** String-specific operators */
export type StringOp = 'like' | 'ilike' | 'startsWith' | 'endsWith' | 'fulltext';

/** Array/set operators */
export type ArrayOp = 'in' | 'contains' | 'containedBy' | 'overlaps' | 'isEmpty';

/** JSON operators */
export type JsonOp = 'jsonContains' | 'hasKey' | 'hasAnyKey';

/** All filter operators */
export type FilterOperator = BaseOp | CompareOp | StringOp | ArrayOp | JsonOp;

// === ValueType → Operator Mapping ===

/** Available value types for filter fields */
export type ValueType = 'string' | 'number' | 'date' | 'boolean' | 'uuid' | 'array' | 'jsonb';

/** Mapping of value types to their available operators */
const operatorsByType = {
  string: ['eq', 'ne', 'isNull', 'like', 'ilike', 'startsWith', 'endsWith', 'fulltext', 'in'],
  number: ['eq', 'ne', 'isNull', 'gt', 'gte', 'lt', 'lte', 'between', 'in'],
  date: ['eq', 'ne', 'isNull', 'gt', 'gte', 'lt', 'lte', 'between'],
  boolean: ['eq', 'isNull'],
  uuid: ['eq', 'ne', 'isNull', 'in'],
  array: ['contains', 'containedBy', 'overlaps', 'isEmpty', 'isNull'],
  jsonb: ['jsonContains', 'hasKey', 'hasAnyKey', 'isNull'],
} as const satisfies Record<ValueType, readonly FilterOperator[]>;

// === Filter Spec Types ===

/** Filter value type based on operator */
export type FilterValue<T extends FilterOperator> = T extends 'isNull' | 'isEmpty'
  ? boolean
  : T extends 'in'
    ? (string | number)[]
    : T extends 'between'
      ? [number | string, number | string]
      : T extends 'contains' | 'containedBy' | 'overlaps' | 'hasAnyKey'
        ? unknown[]
        : T extends 'jsonContains'
          ? unknown
          : string | number | boolean | null;

/** Generic filter specification */
export interface FilterSpec<TField extends string = string, TOp extends FilterOperator = FilterOperator> {
  field: TField;
  op: TOp;
  value: FilterValue<TOp>;
}

/** Filter combination logic */
export type FilterLogic = 'AND' | 'OR';

/** Get operators available for UI selection based on value type */
export function getOperatorsForType(type: ValueType): readonly FilterOperator[] {
  return operatorsByType[type];
}

// === UI Helper Types and Functions ===

/** Operators that don't require a value input */
const noValueOperators = ['isNull', 'isEmpty'] as const;
export type NoValueOperator = (typeof noValueOperators)[number];

/** Check if an operator requires no value input */
export function isNoValueOperator(op: FilterOperator): op is NoValueOperator {
  return noValueOperators.includes(op as NoValueOperator);
}

/** Operator display configuration for UI */
interface OperatorDisplayConfig {
  label: string;
  /** For operators with negation (isNull -> is not null), the negated label */
  negatedLabel?: string;
  /** Whether this operator supports negation in UI */
  supportsNegation?: boolean;
}

/** Display configuration for each operator */
export const operatorDisplayConfig: Record<FilterOperator, OperatorDisplayConfig> = {
  // Base
  eq: { label: 'equals' },
  ne: { label: 'not equals' },
  isNull: { label: 'is null', negatedLabel: 'is not null', supportsNegation: true },
  // Compare
  gt: { label: 'greater than' },
  gte: { label: 'at least' },
  lt: { label: 'less than' },
  lte: { label: 'at most' },
  between: { label: 'between' },
  // String
  like: { label: 'contains (case-sensitive)' },
  ilike: { label: 'contains' },
  startsWith: { label: 'starts with' },
  endsWith: { label: 'ends with' },
  fulltext: { label: 'matches' },
  // Array
  in: { label: 'any of' },
  contains: { label: 'contains all' },
  containedBy: { label: 'contained by' },
  overlaps: { label: 'has any of' },
  isEmpty: { label: 'is empty', negatedLabel: 'is not empty', supportsNegation: true },
  // JSON
  jsonContains: { label: 'contains' },
  hasKey: { label: 'has key' },
  hasAnyKey: { label: 'has any key' },
};

/** Get display label for an operator, optionally negated */
export function getOperatorLabel(op: FilterOperator, negated = false): string {
  const config = operatorDisplayConfig[op];
  if (negated && config.negatedLabel) {
    return config.negatedLabel;
  }
  return config.label;
}
