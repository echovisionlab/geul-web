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

    it('returns true for null', () => {
      expect(isEmpty(null)).toBe(true);
    });
  });

  describe('strings', () => {
    it('returns true for empty string', () => {
      expect(isEmpty('')).toBe(true);
    });

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

    it('returns false for booleans', () => {
      expect(isEmpty(true)).toBe(false);
      expect(isEmpty(false)).toBe(false);
    });

    it('returns false for objects', () => {
      expect(isEmpty({})).toBe(false);
      expect(isEmpty({ key: 'value' })).toBe(false);
    });
  });
});

// =============================================================================
// hasRequired Tests
// =============================================================================

describe('hasRequired', () => {
  it('returns true when field has required validator', () => {
    const field: FormFieldSchema = {
      id: 'field-1',
      name: 'name',
      type: 'text',
      validation: {
        validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
      },
    };
    expect(hasRequired(field)).toBe(true);
  });

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

  it('returns false when field has no validation', () => {
    const field: FormFieldSchema = {
      id: 'field-1',
      name: 'optional',
      type: 'text',
    };
    expect(hasRequired(field)).toBe(false);
  });

  it('returns false when validators array is empty', () => {
    const field: FormFieldSchema = {
      id: 'field-1',
      name: 'empty',
      type: 'text',
      validation: {
        validators: [],
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

  it('returns default message when no custom message', () => {
    const field: FormFieldSchema = {
      id: 'field-1',
      name: 'name',
      type: 'text',
      validation: {
        validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
      },
    };
    expect(getRequiredMessage(field)).toBe('This field is required');
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

  it('returns default message when no required validator', () => {
    const field: FormFieldSchema = {
      id: 'field-1',
      name: 'optional',
      type: 'text',
      validation: {
        validators: [{ id: 'v1', name: 'Max', predicate: 'lte', value: 100 }],
      },
    };
    expect(getRequiredMessage(field)).toBe('This field is required');
  });

  it('returns default message when no validation', () => {
    const field: FormFieldSchema = {
      id: 'field-1',
      name: 'novalidation',
      type: 'text',
    };
    expect(getRequiredMessage(field)).toBe('This field is required');
  });
});

// =============================================================================
// validateWithZod Tests
// =============================================================================

describe('validateWithZod', () => {
  describe('text field validation', () => {
    it('returns success for valid value', () => {
      const field: FormFieldSchema = {
        id: 'field-1',
        name: 'name',
        type: 'text',
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const result = validateWithZod(field, 'John');
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns error for invalid value', () => {
      const field: FormFieldSchema = {
        id: 'field-1',
        name: 'name',
        type: 'text',
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const result = validateWithZod(field, '');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('email field validation', () => {
    it('returns success for valid email', () => {
      const field: FormFieldSchema = {
        id: 'field-1',
        name: 'email',
        type: 'email',
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const result = validateWithZod(field, 'test@example.com');
      expect(result.success).toBe(true);
    });

    it('returns error for invalid email', () => {
      const field: FormFieldSchema = {
        id: 'field-1',
        name: 'email',
        type: 'email',
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const result = validateWithZod(field, 'invalid-email');
      expect(result.success).toBe(false);
      expect(result.error).toContain('email');
    });

    it('returns localized fallback for invalid email when provided', () => {
      const field: FormFieldSchema = {
        id: 'field-1',
        name: 'email',
        type: 'email',
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const result = validateWithZod(field, 'invalid-email', {
        ...defaultFormValidationMessages,
        invalidEmail: '유효한 이메일 주소를 입력하세요',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('유효한 이메일 주소를 입력하세요');
    });
  });

  describe('number field validation', () => {
    it('returns success for valid number', () => {
      const field: FormFieldSchema = {
        id: 'field-1',
        name: 'age',
        type: 'number',
        validation: {
          validators: [{ id: 'v1', name: 'Min', predicate: 'gte', value: 18 }],
        },
      };
      const result = validateWithZod(field, 25);
      expect(result.success).toBe(true);
    });

    it('returns error for invalid number', () => {
      const field: FormFieldSchema = {
        id: 'field-1',
        name: 'age',
        type: 'number',
        validation: {
          validators: [{ id: 'v1', name: 'Min', predicate: 'gte', value: 18 }],
        },
      };
      const result = validateWithZod(field, 15);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('multiselect field validation', () => {
    it('returns success for valid selection', () => {
      const field: FormFieldSchema = {
        id: 'field-1',
        name: 'skills',
        type: 'multiselect',
        options: [
          { label: 'JS', value: 'js' },
          { label: 'TS', value: 'ts' },
        ],
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const result = validateWithZod(field, ['js', 'ts']);
      expect(result.success).toBe(true);
    });

    it('returns error for empty selection when required', () => {
      const field: FormFieldSchema = {
        id: 'field-1',
        name: 'skills',
        type: 'multiselect',
        options: [
          { label: 'JS', value: 'js' },
          { label: 'TS', value: 'ts' },
        ],
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const result = validateWithZod(field, []);
      expect(result.success).toBe(false);
    });
  });

  describe('checkbox field validation', () => {
    it('returns success when required checkbox is checked', () => {
      const field: FormFieldSchema = {
        id: 'field-1',
        name: 'agree',
        type: 'checkbox',
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const result = validateWithZod(field, true);
      expect(result.success).toBe(true);
    });

    it('returns error when required checkbox is not checked', () => {
      const field: FormFieldSchema = {
        id: 'field-1',
        name: 'agree',
        type: 'checkbox',
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required', message: 'You must agree' }],
        },
      };
      const result = validateWithZod(field, false);
      expect(result.success).toBe(false);
      expect(result.error).toBe('You must agree');
    });
  });

  describe('date field validation', () => {
    it('returns success for valid date', () => {
      const field: FormFieldSchema = {
        id: 'field-1',
        name: 'startDate',
        type: 'date',
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const result = validateWithZod(field, '2024-01-15');
      expect(result.success).toBe(true);
    });

    it('returns error for empty date when required', () => {
      const field: FormFieldSchema = {
        id: 'field-1',
        name: 'startDate',
        type: 'date',
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const result = validateWithZod(field, '');
      expect(result.success).toBe(false);
    });

    it('returns error when date is before minDate', () => {
      const field: FormFieldSchema = {
        id: 'field-1',
        name: 'startDate',
        type: 'date',
        validation: {
          validators: [{ id: 'v1', name: 'Min Date', predicate: 'minDate', value: '2024-01-01' }],
        },
      };
      const result = validateWithZod(field, '2023-12-31');
      expect(result.success).toBe(false);
    });
  });

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
