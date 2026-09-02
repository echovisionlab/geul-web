/**
 * Predicate Metadata - Static definitions for all validation predicates
 * Used by FormBuilder UI for metadata lookup (label, requiresValue, supportedFieldTypes)
 */

import type { FieldType } from '@/lib/types/form/model';

// =============================================================================
// Types
// =============================================================================

export type PredicateCategory = 'existence' | 'comparison' | 'format' | 'pattern';

export interface PredicateMetadata {
  readonly name: string;
  readonly label: string;
  readonly description?: string;
  readonly category: PredicateCategory;
  readonly supportedFieldTypes: readonly FieldType[] | 'all';
  readonly requiresValue: boolean;
  readonly valueType?: 'number' | 'string';
}

// =============================================================================
// Predicate Metadata
// =============================================================================

const COMPARISON_FIELD_TYPES = ['text', 'textarea', 'email', 'number', 'multiselect'] as const;

export const PREDICATE_METADATA = {
  // Existence
  required: {
    name: 'required',
    label: 'Required',
    description: 'Value is required',
    category: 'existence',
    supportedFieldTypes: 'all',
    requiresValue: false,
  },

  // Comparison (for text/number/array)
  gt: {
    name: 'gt',
    label: 'Greater than (>)',
    category: 'comparison',
    supportedFieldTypes: COMPARISON_FIELD_TYPES,
    requiresValue: true,
    valueType: 'number',
  },
  gte: {
    name: 'gte',
    label: 'At least (≥)',
    category: 'comparison',
    supportedFieldTypes: COMPARISON_FIELD_TYPES,
    requiresValue: true,
    valueType: 'number',
  },
  lt: {
    name: 'lt',
    label: 'Less than (<)',
    category: 'comparison',
    supportedFieldTypes: COMPARISON_FIELD_TYPES,
    requiresValue: true,
    valueType: 'number',
  },
  lte: {
    name: 'lte',
    label: 'At most (≤)',
    category: 'comparison',
    supportedFieldTypes: COMPARISON_FIELD_TYPES,
    requiresValue: true,
    valueType: 'number',
  },
  eq: {
    name: 'eq',
    label: 'Exactly (=)',
    category: 'comparison',
    supportedFieldTypes: COMPARISON_FIELD_TYPES,
    requiresValue: true,
    valueType: 'number',
  },

  // Format
  email: {
    name: 'email',
    label: 'Email',
    description: 'Email format validation',
    category: 'format',
    supportedFieldTypes: ['text', 'email'],
    requiresValue: false,
  },
  url: {
    name: 'url',
    label: 'URL',
    description: 'URL format validation',
    category: 'format',
    supportedFieldTypes: ['text', 'textarea'],
    requiresValue: false,
  },

  // Pattern
  regex: {
    name: 'regex',
    label: 'Regex',
    description: '정규식 패턴 매칭',
    category: 'pattern',
    supportedFieldTypes: ['text', 'textarea'],
    requiresValue: true,
    valueType: 'string',
  },

  // Date comparisons
  minDate: {
    name: 'minDate',
    label: 'Minimum Date',
    category: 'comparison',
    supportedFieldTypes: ['date'],
    requiresValue: true,
    valueType: 'string',
  },
  maxDate: {
    name: 'maxDate',
    label: 'Maximum Date',
    category: 'comparison',
    supportedFieldTypes: ['date'],
    requiresValue: true,
    valueType: 'string',
  },
  futureDate: {
    name: 'futureDate',
    label: 'Future Date Only',
    category: 'comparison',
    supportedFieldTypes: ['date'],
    requiresValue: false,
  },
  pastDate: {
    name: 'pastDate',
    label: 'Past Date Only',
    category: 'comparison',
    supportedFieldTypes: ['date'],
    requiresValue: false,
  },
  weekdayOnly: {
    name: 'weekdayOnly',
    label: 'Weekdays Only',
    category: 'comparison',
    supportedFieldTypes: ['date'],
    requiresValue: false,
  },
  minAge: {
    name: 'minAge',
    label: 'Minimum Age',
    category: 'comparison',
    supportedFieldTypes: ['date'],
    requiresValue: true,
    valueType: 'number',
  },
  maxAge: {
    name: 'maxAge',
    label: 'Maximum Age',
    category: 'comparison',
    supportedFieldTypes: ['date'],
    requiresValue: true,
    valueType: 'number',
  },
} as const satisfies Record<string, PredicateMetadata>;

// =============================================================================
// Derived Types
// =============================================================================

export type PredicateName = keyof typeof PREDICATE_METADATA;
