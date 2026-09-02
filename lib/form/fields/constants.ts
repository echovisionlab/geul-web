/**
 * Common condition operator constants
 * Separated to avoid circular dependency with registry.ts
 */

import type { FormConditionOperator } from '@/lib/types/form/schema';

/** For text-based fields: text, email, textarea, tel, select */
export const TEXT_CONDITION_OPS: FormConditionOperator[] = ['eq', 'neq', 'in', 'notIn', 'exists'];

/** For numeric/comparable fields: number, date */
export const COMPARISON_CONDITION_OPS: FormConditionOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'exists'];

/** For array-based fields: multiselect, checkbox */
export const ARRAY_CONDITION_OPS: FormConditionOperator[] = [
  'eq',
  'neq',
  'contains',
  'containsAny',
  'containsAll',
  'exists',
];

/** For boolean fields */
export const BOOLEAN_CONDITION_OPS: FormConditionOperator[] = ['eq', 'exists'];
