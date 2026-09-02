/**
 * Unit tests for Zod schema builder
 */

import { describe, expect, it } from 'vitest';
import type { FormFieldSchema } from '@/lib/types/form/schema';
import { defaultFormValidationMessages } from './validation-messages';
import { buildFieldValidator } from './validation-zod';

// =============================================================================
// Text Field Tests
// =============================================================================

describe('buildFieldValidator', () => {
  describe('text field', () => {
    it('validates required text field', () => {
      const field: FormFieldSchema = {
        id: 'text-1',
        name: 'name',
        type: 'text',
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('John').success).toBe(true);
      expect(validator.safeParse('').success).toBe(false);
      expect(validator.safeParse(null).success).toBe(false);
      expect(validator.safeParse(undefined).success).toBe(false);
    });

    it('validates optional text field', () => {
      const field: FormFieldSchema = {
        id: 'text-1',
        name: 'nickname',
        type: 'text',
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('John').success).toBe(true);
      expect(validator.safeParse('').success).toBe(true);
      expect(validator.safeParse(null).success).toBe(true);
    });

    it('validates min length (gte)', () => {
      const field: FormFieldSchema = {
        id: 'text-1',
        name: 'password',
        type: 'text',
        validation: {
          validators: [{ id: 'v1', name: 'Min Length', predicate: 'gte', value: 8 }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('12345678').success).toBe(true);
      expect(validator.safeParse('1234567').success).toBe(false);
    });

    it('validates max length (lte)', () => {
      const field: FormFieldSchema = {
        id: 'text-1',
        name: 'username',
        type: 'text',
        validation: {
          validators: [{ id: 'v1', name: 'Max Length', predicate: 'lte', value: 20 }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('short').success).toBe(true);
      expect(validator.safeParse('a'.repeat(21)).success).toBe(false);
    });

    it('validates exact length (eq)', () => {
      const field: FormFieldSchema = {
        id: 'text-1',
        name: 'code',
        type: 'text',
        validation: {
          validators: [{ id: 'v1', name: 'Exact Length', predicate: 'eq', value: 6 }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('123456').success).toBe(true);
      expect(validator.safeParse('12345').success).toBe(false);
      expect(validator.safeParse('1234567').success).toBe(false);
    });

    it('validates gt (more than N characters)', () => {
      const field: FormFieldSchema = {
        id: 'text-1',
        name: 'bio',
        type: 'text',
        validation: {
          validators: [{ id: 'v1', name: 'More than', predicate: 'gt', value: 10 }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('12345678901').success).toBe(true); // 11 chars
      expect(validator.safeParse('1234567890').success).toBe(false); // 10 chars
    });

    it('validates lt (less than N characters)', () => {
      const field: FormFieldSchema = {
        id: 'text-1',
        name: 'short',
        type: 'text',
        validation: {
          validators: [{ id: 'v1', name: 'Less than', predicate: 'lt', value: 5 }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('abc').success).toBe(true); // 3 chars
      expect(validator.safeParse('abcd').success).toBe(true); // 4 chars
      expect(validator.safeParse('abcde').success).toBe(false); // 5 chars
    });

    it('validates URL format', () => {
      const field: FormFieldSchema = {
        id: 'text-1',
        name: 'website',
        type: 'text',
        validation: {
          validators: [{ id: 'v1', name: 'URL', predicate: 'url' }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('https://example.com').success).toBe(true);
      expect(validator.safeParse('http://localhost:3000').success).toBe(true);
      expect(validator.safeParse('').success).toBe(true); // Empty is allowed if not required
      expect(validator.safeParse('not-a-url').success).toBe(false);
    });

    it('validates regex pattern', () => {
      const field: FormFieldSchema = {
        id: 'text-1',
        name: 'code',
        type: 'text',
        validation: {
          validators: [{ id: 'v1', name: 'Pattern', predicate: 'regex', value: '^[A-Z]{3}\\d{3}$' }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('ABC123').success).toBe(true);
      expect(validator.safeParse('').success).toBe(true); // Empty allowed if not required
      expect(validator.safeParse('abc123').success).toBe(false);
      expect(validator.safeParse('AB123').success).toBe(false);
    });
  });

  // =============================================================================
  // Email Field Tests
  // =============================================================================

  describe('email field', () => {
    it('validates required email', () => {
      const field: FormFieldSchema = {
        id: 'email-1',
        name: 'email',
        type: 'email',
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('test@example.com').success).toBe(true);
      expect(validator.safeParse('').success).toBe(false);
    });

    it('validates optional email', () => {
      const field: FormFieldSchema = {
        id: 'email-1',
        name: 'email',
        type: 'email',
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('test@example.com').success).toBe(true);
      expect(validator.safeParse('').success).toBe(true);
      expect(validator.safeParse(undefined).success).toBe(true);
    });

    it('validates email format', () => {
      const field: FormFieldSchema = {
        id: 'email-1',
        name: 'email',
        type: 'email',
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('invalid-email').success).toBe(false);
      expect(validator.safeParse('missing@domain').success).toBe(false);
      expect(validator.safeParse('@example.com').success).toBe(false);
    });

    it('validates email with length constraints', () => {
      const field: FormFieldSchema = {
        id: 'email-1',
        name: 'email',
        type: 'email',
        validation: {
          validators: [
            { id: 'v1', name: 'Required', predicate: 'required' },
            { id: 'v2', name: 'Max Length', predicate: 'lte', value: 50 },
          ],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('short@example.com').success).toBe(true);
      expect(validator.safeParse(`${'a'.repeat(50)}@example.com`).success).toBe(false);
    });
  });

  // =============================================================================
  // Number Field Tests
  // =============================================================================

  describe('number field', () => {
    it('validates required number', () => {
      const field: FormFieldSchema = {
        id: 'num-1',
        name: 'age',
        type: 'number',
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse(25).success).toBe(true);
      expect(validator.safeParse(0).success).toBe(true);
    });

    it('validates optional number', () => {
      const field: FormFieldSchema = {
        id: 'num-1',
        name: 'score',
        type: 'number',
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse(100).success).toBe(true);
      expect(validator.safeParse(undefined).success).toBe(true);
    });

    it('validates minimum value (gte)', () => {
      const field: FormFieldSchema = {
        id: 'num-1',
        name: 'age',
        type: 'number',
        validation: {
          validators: [{ id: 'v1', name: 'Min', predicate: 'gte', value: 18 }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse(18).success).toBe(true);
      expect(validator.safeParse(21).success).toBe(true);
      expect(validator.safeParse(17).success).toBe(false);
    });

    it('validates maximum value (lte)', () => {
      const field: FormFieldSchema = {
        id: 'num-1',
        name: 'quantity',
        type: 'number',
        validation: {
          validators: [{ id: 'v1', name: 'Max', predicate: 'lte', value: 100 }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse(100).success).toBe(true);
      expect(validator.safeParse(50).success).toBe(true);
      expect(validator.safeParse(101).success).toBe(false);
    });

    it('validates greater than (gt)', () => {
      const field: FormFieldSchema = {
        id: 'num-1',
        name: 'price',
        type: 'number',
        validation: {
          validators: [{ id: 'v1', name: 'Greater than', predicate: 'gt', value: 0 }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse(1).success).toBe(true);
      expect(validator.safeParse(0).success).toBe(false);
      expect(validator.safeParse(-1).success).toBe(false);
    });

    it('validates less than (lt)', () => {
      const field: FormFieldSchema = {
        id: 'num-1',
        name: 'discount',
        type: 'number',
        validation: {
          validators: [{ id: 'v1', name: 'Less than', predicate: 'lt', value: 100 }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse(99).success).toBe(true);
      expect(validator.safeParse(100).success).toBe(false);
    });

    it('validates exact value (eq)', () => {
      const field: FormFieldSchema = {
        id: 'num-1',
        name: 'expected',
        type: 'number',
        validation: {
          validators: [{ id: 'v1', name: 'Exact', predicate: 'eq', value: 42 }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse(42).success).toBe(true);
      expect(validator.safeParse(41).success).toBe(false);
      expect(validator.safeParse(43).success).toBe(false);
    });

    it('validates range (gte + lte)', () => {
      const field: FormFieldSchema = {
        id: 'num-1',
        name: 'rating',
        type: 'number',
        validation: {
          validators: [
            { id: 'v1', name: 'Min', predicate: 'gte', value: 1 },
            { id: 'v2', name: 'Max', predicate: 'lte', value: 5 },
          ],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse(1).success).toBe(true);
      expect(validator.safeParse(3).success).toBe(true);
      expect(validator.safeParse(5).success).toBe(true);
      expect(validator.safeParse(0).success).toBe(false);
      expect(validator.safeParse(6).success).toBe(false);
    });
  });

  // =============================================================================
  // Select Field Tests
  // =============================================================================

  describe('select field', () => {
    it('validates required select', () => {
      const field: FormFieldSchema = {
        id: 'select-1',
        name: 'country',
        type: 'select',
        options: [
          { label: 'Korea', value: 'kr' },
          { label: 'USA', value: 'us' },
        ],
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('kr').success).toBe(true);
      expect(validator.safeParse('').success).toBe(false);
    });

    it('validates optional select', () => {
      const field: FormFieldSchema = {
        id: 'select-1',
        name: 'preference',
        type: 'select',
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('a').success).toBe(true);
      expect(validator.safeParse('').success).toBe(true);
    });
  });

  // =============================================================================
  // Multiselect Field Tests
  // =============================================================================

  describe('multiselect field', () => {
    it('validates required multiselect', () => {
      const field: FormFieldSchema = {
        id: 'multi-1',
        name: 'interests',
        type: 'multiselect',
        options: [
          { label: 'Music', value: 'music' },
          { label: 'Art', value: 'art' },
          { label: 'Sports', value: 'sports' },
        ],
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse(['music']).success).toBe(true);
      expect(validator.safeParse(['music', 'art']).success).toBe(true);
      expect(validator.safeParse([]).success).toBe(false);
    });

    it('validates minimum selection count (gte)', () => {
      const field: FormFieldSchema = {
        id: 'multi-1',
        name: 'skills',
        type: 'multiselect',
        options: [
          { label: 'JS', value: 'js' },
          { label: 'TS', value: 'ts' },
          { label: 'Go', value: 'go' },
        ],
        validation: {
          validators: [{ id: 'v1', name: 'Min', predicate: 'gte', value: 2 }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse(['js', 'ts']).success).toBe(true);
      expect(validator.safeParse(['js']).success).toBe(false);
    });

    it('validates maximum selection count (lte)', () => {
      const field: FormFieldSchema = {
        id: 'multi-1',
        name: 'topics',
        type: 'multiselect',
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
          { label: 'C', value: 'c' },
          { label: 'D', value: 'd' },
        ],
        validation: {
          validators: [{ id: 'v1', name: 'Max', predicate: 'lte', value: 2 }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse(['a']).success).toBe(true);
      expect(validator.safeParse(['a', 'b']).success).toBe(true);
      expect(validator.safeParse(['a', 'b', 'c']).success).toBe(false);
    });

    it('validates exact selection count (eq)', () => {
      const field: FormFieldSchema = {
        id: 'multi-1',
        name: 'picks',
        type: 'multiselect',
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
          { label: 'C', value: 'c' },
        ],
        validation: {
          validators: [{ id: 'v1', name: 'Exact', predicate: 'eq', value: 2 }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse(['a', 'b']).success).toBe(true);
      expect(validator.safeParse(['a']).success).toBe(false);
      expect(validator.safeParse(['a', 'b', 'c']).success).toBe(false);
    });

    it('handles null/undefined as empty array', () => {
      const field: FormFieldSchema = {
        id: 'multi-1',
        name: 'tags',
        type: 'multiselect',
        options: [{ label: 'A', value: 'a' }],
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse(null).success).toBe(true);
      expect(validator.safeParse(undefined).success).toBe(true);
    });
  });

  // =============================================================================
  // Switch Field Tests
  // =============================================================================

  describe('switch field', () => {
    it('validates required switch (must be true/false)', () => {
      const field: FormFieldSchema = {
        id: 'switch-1',
        name: 'enabled',
        type: 'switch',
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse(true).success).toBe(true);
      expect(validator.safeParse(false).success).toBe(true);
    });

    it('validates optional switch', () => {
      const field: FormFieldSchema = {
        id: 'switch-1',
        name: 'newsletter',
        type: 'switch',
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse(true).success).toBe(true);
      expect(validator.safeParse(false).success).toBe(true);
      expect(validator.safeParse(undefined).success).toBe(true);
    });
  });

  // =============================================================================
  // Checkbox Field Tests
  // =============================================================================

  describe('checkbox field', () => {
    it('validates required checkbox (must be true)', () => {
      const field: FormFieldSchema = {
        id: 'checkbox-1',
        name: 'agree',
        type: 'checkbox',
        checkboxLabel: 'I agree to terms',
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse(true).success).toBe(true);
      expect(validator.safeParse(false).success).toBe(false);
    });

    it('validates optional checkbox', () => {
      const field: FormFieldSchema = {
        id: 'checkbox-1',
        name: 'subscribe',
        type: 'checkbox',
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse(true).success).toBe(true);
      expect(validator.safeParse(false).success).toBe(true);
      expect(validator.safeParse(undefined).success).toBe(true);
    });
  });

  // =============================================================================
  // Date Field Tests
  // =============================================================================

  describe('date field', () => {
    it('validates required date', () => {
      const field: FormFieldSchema = {
        id: 'date-1',
        name: 'birthDate',
        type: 'date',
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('2000-01-15').success).toBe(true);
      expect(validator.safeParse('').success).toBe(false);
    });

    it('validates optional date', () => {
      const field: FormFieldSchema = {
        id: 'date-1',
        name: 'startDate',
        type: 'date',
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('2024-01-15').success).toBe(true);
      expect(validator.safeParse('').success).toBe(true);
    });

    it('validates minimum date', () => {
      const field: FormFieldSchema = {
        id: 'date-1',
        name: 'startDate',
        type: 'date',
        validation: {
          validators: [{ id: 'v1', name: 'Min Date', predicate: 'minDate', value: '2024-01-01' }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('2024-01-01').success).toBe(true);
      expect(validator.safeParse('2024-06-15').success).toBe(true);
      expect(validator.safeParse('2023-12-31').success).toBe(false);
    });

    it('validates maximum date', () => {
      const field: FormFieldSchema = {
        id: 'date-1',
        name: 'endDate',
        type: 'date',
        validation: {
          validators: [{ id: 'v1', name: 'Max Date', predicate: 'maxDate', value: '2024-12-31' }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('2024-12-31').success).toBe(true);
      expect(validator.safeParse('2024-06-15').success).toBe(true);
      expect(validator.safeParse('2025-01-01').success).toBe(false);
    });

    it('validates weekday only', () => {
      const field: FormFieldSchema = {
        id: 'date-1',
        name: 'appointmentDate',
        type: 'date',
        validation: {
          validators: [{ id: 'v1', name: 'Weekday', predicate: 'weekdayOnly' }],
        },
      };
      const validator = buildFieldValidator(field);

      // Monday
      expect(validator.safeParse('2024-01-08').success).toBe(true);
      // Saturday
      expect(validator.safeParse('2024-01-06').success).toBe(false);
      // Sunday
      expect(validator.safeParse('2024-01-07').success).toBe(false);
    });

    it('validates minimum age', () => {
      const field: FormFieldSchema = {
        id: 'date-1',
        name: 'birthDate',
        type: 'date',
        validation: {
          validators: [{ id: 'v1', name: 'Min Age', predicate: 'minAge', value: 18 }],
        },
      };
      const validator = buildFieldValidator(field);

      // Someone born 20 years ago
      const twentyYearsAgo = new Date();
      twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
      const twentyYearsAgoStr = twentyYearsAgo.toISOString().split('T')[0];
      expect(validator.safeParse(twentyYearsAgoStr).success).toBe(true);

      // Someone born 10 years ago
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      const tenYearsAgoStr = tenYearsAgo.toISOString().split('T')[0];
      expect(validator.safeParse(tenYearsAgoStr).success).toBe(false);
    });

    it('validates maximum age', () => {
      const field: FormFieldSchema = {
        id: 'date-1',
        name: 'birthDate',
        type: 'date',
        validation: {
          validators: [{ id: 'v1', name: 'Max Age', predicate: 'maxAge', value: 65 }],
        },
      };
      const validator = buildFieldValidator(field);

      // Someone born 60 years ago
      const sixtyYearsAgo = new Date();
      sixtyYearsAgo.setFullYear(sixtyYearsAgo.getFullYear() - 60);
      const sixtyYearsAgoStr = sixtyYearsAgo.toISOString().split('T')[0];
      expect(validator.safeParse(sixtyYearsAgoStr).success).toBe(true);

      // Someone born 70 years ago
      const seventyYearsAgo = new Date();
      seventyYearsAgo.setFullYear(seventyYearsAgo.getFullYear() - 70);
      const seventyYearsAgoStr = seventyYearsAgo.toISOString().split('T')[0];
      expect(validator.safeParse(seventyYearsAgoStr).success).toBe(false);
    });
  });

  // =============================================================================
  // Textarea Field Tests
  // =============================================================================

  describe('textarea field', () => {
    it('validates required textarea', () => {
      const field: FormFieldSchema = {
        id: 'textarea-1',
        name: 'bio',
        type: 'textarea',
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('Some text here').success).toBe(true);
      expect(validator.safeParse('').success).toBe(false);
    });

    it('validates textarea with length constraints', () => {
      const field: FormFieldSchema = {
        id: 'textarea-1',
        name: 'description',
        type: 'textarea',
        validation: {
          validators: [
            { id: 'v1', name: 'Min', predicate: 'gte', value: 10 },
            { id: 'v2', name: 'Max', predicate: 'lte', value: 500 },
          ],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('Short text here').success).toBe(true);
      expect(validator.safeParse('Short').success).toBe(false); // Less than 10
      expect(validator.safeParse('a'.repeat(501)).success).toBe(false); // More than 500
    });
  });

  // =============================================================================
  // Phone (Tel) Field Tests
  // =============================================================================

  describe('tel field', () => {
    it('validates required phone', () => {
      const field: FormFieldSchema = {
        id: 'tel-1',
        name: 'phone',
        type: 'tel',
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
        },
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('010-1234-5678').success).toBe(true);
      expect(validator.safeParse('').success).toBe(false);
    });

    it('validates optional phone', () => {
      const field: FormFieldSchema = {
        id: 'tel-1',
        name: 'altPhone',
        type: 'tel',
      };
      const validator = buildFieldValidator(field);

      expect(validator.safeParse('010-1234-5678').success).toBe(true);
      expect(validator.safeParse('').success).toBe(true);
    });
  });

  // =============================================================================
  // Custom Error Messages Tests
  // =============================================================================

  describe('custom error messages', () => {
    it('uses custom required message', () => {
      const field: FormFieldSchema = {
        id: 'text-1',
        name: 'name',
        type: 'text',
        validation: {
          validators: [{ id: 'v1', name: 'Required', predicate: 'required', message: 'Name is mandatory' }],
        },
      };
      const validator = buildFieldValidator(field);
      const result = validator.safeParse('');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Name is mandatory');
      }
    });

    it('uses custom min length message', () => {
      const field: FormFieldSchema = {
        id: 'text-1',
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
      const validator = buildFieldValidator(field);
      const result = validator.safeParse('short');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Password must be at least 8 characters');
      }
    });

    it('uses custom URL validation message', () => {
      const field: FormFieldSchema = {
        id: 'text-1',
        name: 'website',
        type: 'text',
        validation: {
          validators: [
            {
              id: 'v1',
              name: 'URL',
              predicate: 'url',
              message: 'Please enter a valid website URL',
            },
          ],
        },
      };
      const validator = buildFieldValidator(field);
      const result = validator.safeParse('invalid-url');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Please enter a valid website URL');
      }
    });

    it('uses localized fallback messages when no custom message is set', () => {
      const field: FormFieldSchema = {
        id: 'text-1',
        name: 'password',
        type: 'text',
        validation: {
          validators: [{ id: 'v1', name: 'Min Length', predicate: 'gte', value: 8 }],
        },
      };
      const validator = buildFieldValidator(field, {
        ...defaultFormValidationMessages,
        stringGte: (threshold) => `최소 ${threshold}자 입력하세요`,
      });
      const result = validator.safeParse('short');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('최소 8자 입력하세요');
      }
    });
  });
});
