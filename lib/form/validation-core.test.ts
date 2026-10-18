/**
 * Unit tests for core validation functions
 */

import { describe, expect, it } from 'vitest';
import type { FormFieldSchema } from '@/lib/types/form/schema';
import { getRequiredMessage, hasRequired, isEmpty, validateWithZod } from './validation-core';
import { defaultFormValidationMessages } from './validation-messages';

// =============================================================================
// isEmpty Tests
// =============================================================================

describe('isEmpty', () => {
  describe('undefined and null', () => {
    it('returns true for undefined', () => {
      expect(isEmpty(undefined)).toBe(true);
    });
  });

  describe('strings', () => {
    it('returns true for whitespace-only string', () => {
      expect(isEmpty('   ')).toBe(true);
      expect(isEmpty('\t')).toBe(true);
      expect(isEmpty('\n')).toBe(true);
    });

    it('returns false for non-empty string', () => {
      expect(isEmpty('hello')).toBe(false);
      expect(isEmpty('  hello  ')).toBe(false);
    });
  });

  describe('arrays', () => {
    it('returns true for empty array', () => {
      expect(isEmpty([])).toBe(true);
    });

    it('returns false for non-empty array', () => {
      expect(isEmpty([1])).toBe(false);
      expect(isEmpty(['a', 'b'])).toBe(false);
    });
  });

  describe('other types', () => {
    it('returns false for numbers (including 0)', () => {
      expect(isEmpty(0)).toBe(false);
      expect(isEmpty(42)).toBe(false);
      expect(isEmpty(-1)).toBe(false);
    });
  });
});

// =============================================================================
// hasRequired Tests
// =============================================================================

describe('hasRequired', () => {
  it('returns true when required validator is among other validators', () => {
    const field: FormFieldSchema = {
      id: 'field-1',
      name: 'password',
      type: 'text',
      validation: {
        validators: [
          { id: 'v1', name: 'Min Length', predicate: 'gte', value: 8 },
          { id: 'v2', name: 'Required', predicate: 'required' },
          { id: 'v3', name: 'Max Length', predicate: 'lte', value: 50 },
        ],
      },
    };
    expect(hasRequired(field)).toBe(true);
  });

  it('returns false when field has no required validator', () => {
    const field: FormFieldSchema = {
      id: 'field-1',
      name: 'nickname',
      type: 'text',
      validation: {
        validators: [{ id: 'v1', name: 'Max Length', predicate: 'lte', value: 20 }],
      },
    };
    expect(hasRequired(field)).toBe(false);
  });
});

// =============================================================================
// getRequiredMessage Tests
// =============================================================================

describe('getRequiredMessage', () => {
  it('returns custom message when specified', () => {
    const field: FormFieldSchema = {
      id: 'field-1',
      name: 'email',
      type: 'email',
      validation: {
        validators: [{ id: 'v1', name: 'Required', predicate: 'required', message: 'Email is mandatory' }],
      },
    };
    expect(getRequiredMessage(field)).toBe('Email is mandatory');
  });

  it('returns localized fallback message when provided', () => {
    const field: FormFieldSchema = {
      id: 'field-1',
      name: 'name',
      type: 'text',
      validation: {
        validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
      },
    };
    expect(
      getRequiredMessage(field, {
        ...defaultFormValidationMessages,
        required: '필수 입력 항목입니다',
      }),
    ).toBe('필수 입력 항목입니다');
  });
});

// =============================================================================
// validateWithZod Tests
// =============================================================================

describe('validateWithZod', () => {
  describe('custom error messages', () => {
    it('returns custom error message from validator', () => {
      const field: FormFieldSchema = {
        id: 'field-1',
        name: 'password',
        type: 'text',
        validation: {
          validators: [
            {
              id: 'v1',
              name: 'Min Length',
              predicate: 'gte',
              value: 8,
              message: 'Password must be at least 8 characters',
            },
          ],
        },
      };
      const result = validateWithZod(field, 'short');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Password must be at least 8 characters');
    });
  });
});
