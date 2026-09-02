/**
 * Field Type Registry
 * Central registry for all field type definitions
 */

import type { FieldType } from '@/lib/types/form/model';
import type { FormConditionOperator } from '@/lib/types/form/schema';
import { fieldTypeRegistry } from './core';
// =============================================================================
// Initialize registry with all field types
// =============================================================================
import './text';
import './email';
import './textarea';
import './tel';
import './number';
import './select';
import './multiselect';
import './checkbox';
import './switch';
import './date';

// Re-export registry from core (must be first, before field imports)
export { fieldTypeRegistry } from './core';

// =============================================================================
// Operator Helpers
// =============================================================================

export interface OperatorOption {
  label: string;
  value: FormConditionOperator;
}

/**
 * Operator labels mapping
 */
const OPERATOR_LABELS: Record<FormConditionOperator, string> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  in: 'in (any of)',
  notIn: 'not in (none of)',
  contains: 'contains',
  containsAny: 'contains any',
  containsAll: 'contains all',
  exists: 'exists',
};

/**
 * Default operators when no field type definition is found
 */
const DEFAULT_OPERATORS: FormConditionOperator[] = ['eq', 'neq', 'in', 'notIn', 'exists'];

/**
 * Convert operator list to OperatorOption array
 */
function toOperatorOptions(operators: FormConditionOperator[]): OperatorOption[] {
  return operators.map((op) => ({
    label: OPERATOR_LABELS[op],
    value: op,
  }));
}

/**
 * Get available operators for a given field type
 */
export function getOperatorsForFieldType(fieldType: FieldType | undefined): OperatorOption[] {
  if (!fieldType) {
    return toOperatorOptions(['eq', 'neq', 'exists']);
  }

  const definition = fieldTypeRegistry.get(fieldType);
  if (definition) {
    return toOperatorOptions(definition.conditionOperators);
  }

  return toOperatorOptions(DEFAULT_OPERATORS);
}

// =============================================================================
// Re-export types for convenience
// =============================================================================
