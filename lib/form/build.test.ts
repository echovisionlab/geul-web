/**
 * Unit tests for form build logic
 */

import { describe, expect, it } from 'vitest';
import type { FormConditionGroup, FormSchema, FormStepCondition } from '@/lib/types/form/schema';
import { buildForm, evaluateConditionLogic, normalizeFormSchema } from './build';
import { defaultFormValidationMessages } from './validation-messages';

// =============================================================================
// evaluateConditionLogic Tests
// =============================================================================

describe('evaluateConditionLogic', () => {
  describe('eq operator', () => {
    it('returns true when field value equals condition value', () => {
      const condition: FormStepCondition = {
        field: 'status',
        operator: 'eq',
        value: 'active',
      };
      expect(evaluateConditionLogic(condition, { status: 'active' })).toBe(true);
    });

    it('returns false when field value does not equal condition value', () => {
      const condition: FormStepCondition = {
        field: 'status',
        operator: 'eq',
        value: 'active',
      };
      expect(evaluateConditionLogic(condition, { status: 'inactive' })).toBe(false);
    });

    it('handles numeric equality', () => {
      const condition: FormStepCondition = {
        field: 'count',
        operator: 'eq',
        value: 5,
      };
      expect(evaluateConditionLogic(condition, { count: 5 })).toBe(true);
      expect(evaluateConditionLogic(condition, { count: 6 })).toBe(false);
    });

    it('handles boolean equality', () => {
      const condition: FormStepCondition = {
        field: 'enabled',
        operator: 'eq',
        value: true,
      };
      expect(evaluateConditionLogic(condition, { enabled: true })).toBe(true);
      expect(evaluateConditionLogic(condition, { enabled: false })).toBe(false);
    });
  });

  describe('neq operator', () => {
    it('returns true when field value does not equal condition value', () => {
      const condition: FormStepCondition = {
        field: 'status',
        operator: 'neq',
        value: 'active',
      };
      expect(evaluateConditionLogic(condition, { status: 'inactive' })).toBe(true);
    });

    it('returns false when field value equals condition value', () => {
      const condition: FormStepCondition = {
        field: 'status',
        operator: 'neq',
        value: 'active',
      };
      expect(evaluateConditionLogic(condition, { status: 'active' })).toBe(false);
    });
  });

  describe('gt operator', () => {
    it('returns true when field value is greater than condition value (number)', () => {
      const condition: FormStepCondition = {
        field: 'age',
        operator: 'gt',
        value: 18,
      };
      expect(evaluateConditionLogic(condition, { age: 21 })).toBe(true);
    });

    it('returns false when field value is not greater than condition value', () => {
      const condition: FormStepCondition = {
        field: 'age',
        operator: 'gt',
        value: 18,
      };
      expect(evaluateConditionLogic(condition, { age: 18 })).toBe(false);
      expect(evaluateConditionLogic(condition, { age: 16 })).toBe(false);
    });

    it('returns true when field value is greater than condition value (date string)', () => {
      const condition: FormStepCondition = {
        field: 'date',
        operator: 'gt',
        value: '2024-01-01',
      };
      expect(evaluateConditionLogic(condition, { date: '2024-06-01' })).toBe(true);
    });

    it('returns false for mixed types', () => {
      const condition: FormStepCondition = {
        field: 'value',
        operator: 'gt',
        value: 10,
      };
      expect(evaluateConditionLogic(condition, { value: 'string' })).toBe(false);
    });
  });

  describe('gte operator', () => {
    it('returns true when field value is greater than or equal to condition value', () => {
      const condition: FormStepCondition = {
        field: 'age',
        operator: 'gte',
        value: 18,
      };
      expect(evaluateConditionLogic(condition, { age: 18 })).toBe(true);
      expect(evaluateConditionLogic(condition, { age: 21 })).toBe(true);
    });

    it('returns false when field value is less than condition value', () => {
      const condition: FormStepCondition = {
        field: 'age',
        operator: 'gte',
        value: 18,
      };
      expect(evaluateConditionLogic(condition, { age: 16 })).toBe(false);
    });
  });

  describe('lt operator', () => {
    it('returns true when field value is less than condition value', () => {
      const condition: FormStepCondition = {
        field: 'age',
        operator: 'lt',
        value: 18,
      };
      expect(evaluateConditionLogic(condition, { age: 16 })).toBe(true);
    });

    it('returns false when field value is not less than condition value', () => {
      const condition: FormStepCondition = {
        field: 'age',
        operator: 'lt',
        value: 18,
      };
      expect(evaluateConditionLogic(condition, { age: 18 })).toBe(false);
      expect(evaluateConditionLogic(condition, { age: 21 })).toBe(false);
    });
  });

  describe('lte operator', () => {
    it('returns true when field value is less than or equal to condition value', () => {
      const condition: FormStepCondition = {
        field: 'age',
        operator: 'lte',
        value: 18,
      };
      expect(evaluateConditionLogic(condition, { age: 18 })).toBe(true);
      expect(evaluateConditionLogic(condition, { age: 16 })).toBe(true);
    });

    it('returns false when field value is greater than condition value', () => {
      const condition: FormStepCondition = {
        field: 'age',
        operator: 'lte',
        value: 18,
      };
      expect(evaluateConditionLogic(condition, { age: 21 })).toBe(false);
    });
  });

  describe('in operator', () => {
    it('returns true when field value is in the condition array', () => {
      const condition: FormStepCondition = {
        field: 'status',
        operator: 'in',
        value: ['active', 'pending', 'review'],
      };
      expect(evaluateConditionLogic(condition, { status: 'active' })).toBe(true);
      expect(evaluateConditionLogic(condition, { status: 'pending' })).toBe(true);
    });

    it('returns false when field value is not in the condition array', () => {
      const condition: FormStepCondition = {
        field: 'status',
        operator: 'in',
        value: ['active', 'pending'],
      };
      expect(evaluateConditionLogic(condition, { status: 'inactive' })).toBe(false);
    });

    it('returns false when condition value is not an array', () => {
      const condition: FormStepCondition = {
        field: 'status',
        operator: 'in',
        value: 'active',
      };
      expect(evaluateConditionLogic(condition, { status: 'active' })).toBe(false);
    });
  });

  describe('notIn operator', () => {
    it('returns true when field value is not in the condition array', () => {
      const condition: FormStepCondition = {
        field: 'status',
        operator: 'notIn',
        value: ['banned', 'suspended'],
      };
      expect(evaluateConditionLogic(condition, { status: 'active' })).toBe(true);
    });

    it('returns false when field value is in the condition array', () => {
      const condition: FormStepCondition = {
        field: 'status',
        operator: 'notIn',
        value: ['banned', 'suspended'],
      };
      expect(evaluateConditionLogic(condition, { status: 'banned' })).toBe(false);
    });

    it('returns false when condition value is not an array', () => {
      const condition: FormStepCondition = {
        field: 'status',
        operator: 'notIn',
        value: 'banned',
      };
      expect(evaluateConditionLogic(condition, { status: 'active' })).toBe(false);
    });
  });

  describe('contains operator', () => {
    it('returns true when field array contains condition value', () => {
      const condition: FormStepCondition = {
        field: 'tags',
        operator: 'contains',
        value: 'music',
      };
      expect(evaluateConditionLogic(condition, { tags: ['music', 'art', 'culture'] })).toBe(true);
    });

    it('returns false when field array does not contain condition value', () => {
      const condition: FormStepCondition = {
        field: 'tags',
        operator: 'contains',
        value: 'sports',
      };
      expect(evaluateConditionLogic(condition, { tags: ['music', 'art'] })).toBe(false);
    });

    it('returns false when field value is not an array', () => {
      const condition: FormStepCondition = {
        field: 'tags',
        operator: 'contains',
        value: 'music',
      };
      expect(evaluateConditionLogic(condition, { tags: 'music' })).toBe(false);
    });
  });

  describe('containsAny operator', () => {
    it('returns true when field array contains any of the condition values', () => {
      const condition: FormStepCondition = {
        field: 'categories',
        operator: 'containsAny',
        value: ['rock', 'jazz', 'classical'],
      };
      expect(evaluateConditionLogic(condition, { categories: ['pop', 'rock'] })).toBe(true);
    });

    it('returns false when field array contains none of the condition values', () => {
      const condition: FormStepCondition = {
        field: 'categories',
        operator: 'containsAny',
        value: ['rock', 'jazz'],
      };
      expect(evaluateConditionLogic(condition, { categories: ['pop', 'hip-hop'] })).toBe(false);
    });

    it('returns false when either value is not an array', () => {
      const condition: FormStepCondition = {
        field: 'categories',
        operator: 'containsAny',
        value: 'rock',
      };
      expect(evaluateConditionLogic(condition, { categories: ['rock'] })).toBe(false);
    });
  });

  describe('containsAll operator', () => {
    it('returns true when field array contains all condition values', () => {
      const condition: FormStepCondition = {
        field: 'skills',
        operator: 'containsAll',
        value: ['javascript', 'typescript'],
      };
      expect(evaluateConditionLogic(condition, { skills: ['javascript', 'typescript', 'react'] })).toBe(true);
    });

    it('returns false when field array does not contain all condition values', () => {
      const condition: FormStepCondition = {
        field: 'skills',
        operator: 'containsAll',
        value: ['javascript', 'typescript', 'go'],
      };
      expect(evaluateConditionLogic(condition, { skills: ['javascript', 'typescript'] })).toBe(false);
    });
  });

  describe('exists operator', () => {
    it('returns true when field has a non-empty value', () => {
      const condition: FormStepCondition = {
        field: 'email',
        operator: 'exists',
      };
      expect(evaluateConditionLogic(condition, { email: 'test@example.com' })).toBe(true);
      expect(evaluateConditionLogic(condition, { email: 0 })).toBe(true);
      expect(evaluateConditionLogic(condition, { email: false })).toBe(true);
    });

    it('returns false when field is undefined, null, or empty string', () => {
      const condition: FormStepCondition = {
        field: 'email',
        operator: 'exists',
      };
      expect(evaluateConditionLogic(condition, {})).toBe(false);
      expect(evaluateConditionLogic(condition, { email: undefined })).toBe(false);
      expect(evaluateConditionLogic(condition, { email: null })).toBe(false);
      expect(evaluateConditionLogic(condition, { email: '' })).toBe(false);
    });
  });

  describe('condition groups', () => {
    it('evaluates AND logic correctly - all true', () => {
      const group: FormConditionGroup = {
        logic: 'and',
        conditions: [
          { field: 'status', operator: 'eq', value: 'active' },
          { field: 'age', operator: 'gte', value: 18 },
        ],
      };
      expect(evaluateConditionLogic(group, { status: 'active', age: 21 })).toBe(true);
    });

    it('evaluates AND logic correctly - one false', () => {
      const group: FormConditionGroup = {
        logic: 'and',
        conditions: [
          { field: 'status', operator: 'eq', value: 'active' },
          { field: 'age', operator: 'gte', value: 18 },
        ],
      };
      expect(evaluateConditionLogic(group, { status: 'active', age: 16 })).toBe(false);
    });

    it('evaluates OR logic correctly - one true', () => {
      const group: FormConditionGroup = {
        logic: 'or',
        conditions: [
          { field: 'role', operator: 'eq', value: 'admin' },
          { field: 'role', operator: 'eq', value: 'moderator' },
        ],
      };
      expect(evaluateConditionLogic(group, { role: 'admin' })).toBe(true);
      expect(evaluateConditionLogic(group, { role: 'moderator' })).toBe(true);
    });

    it('evaluates OR logic correctly - all false', () => {
      const group: FormConditionGroup = {
        logic: 'or',
        conditions: [
          { field: 'role', operator: 'eq', value: 'admin' },
          { field: 'role', operator: 'eq', value: 'moderator' },
        ],
      };
      expect(evaluateConditionLogic(group, { role: 'user' })).toBe(false);
    });

    it('evaluates nested groups', () => {
      const group: FormConditionGroup = {
        logic: 'and',
        conditions: [
          { field: 'status', operator: 'eq', value: 'active' },
          {
            logic: 'or',
            conditions: [
              { field: 'role', operator: 'eq', value: 'admin' },
              { field: 'role', operator: 'eq', value: 'moderator' },
            ],
          },
        ],
      };
      expect(evaluateConditionLogic(group, { status: 'active', role: 'admin' })).toBe(true);
      expect(evaluateConditionLogic(group, { status: 'active', role: 'user' })).toBe(false);
      expect(evaluateConditionLogic(group, { status: 'inactive', role: 'admin' })).toBe(false);
    });
  });
});

// =============================================================================
// buildForm Tests
// =============================================================================

describe('buildForm', () => {
  const createBasicSchema = (): FormSchema => ({
    id: 'test-form',
    steps: [
      {
        id: 'step-1',
        title: 'Basic Info',
        fields: [
          {
            id: 'field-name',
            name: 'name',
            type: 'text',
            validation: {
              validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
            },
          },
          {
            id: 'field-email',
            name: 'email',
            type: 'email',
            validation: {
              validators: [{ id: 'v2', name: 'Required', predicate: 'required' }],
            },
          },
        ],
      },
    ],
  });

  describe('parse', () => {
    it('parses valid data successfully', () => {
      const schema = createBasicSchema();
      const form = buildForm(schema);
      const result = form.parse({ name: 'John', email: 'john@example.com' });
      expect(result).toEqual({ name: 'John', email: 'john@example.com' });
    });

    it('throws on invalid data', () => {
      const schema = createBasicSchema();
      const form = buildForm(schema);
      expect(() => form.parse({ name: '', email: '' })).toThrow();
    });
  });

  describe('safeParse', () => {
    it('returns success for valid data', () => {
      const schema = createBasicSchema();
      const form = buildForm(schema);
      const result = form.safeParse({ name: 'John', email: 'john@example.com' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: 'John', email: 'john@example.com' });
      }
    });

    it('returns error for invalid data', () => {
      const schema = createBasicSchema();
      const form = buildForm(schema);
      const result = form.safeParse({ name: '', email: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('getVisibleSteps', () => {
    it('returns all steps when no conditions', () => {
      const schema: FormSchema = {
        id: 'test-form',
        steps: [
          { id: 'step-1', title: 'Step 1' },
          { id: 'step-2', title: 'Step 2' },
        ],
      };
      const form = buildForm(schema);
      const visibleSteps = form.getVisibleSteps({});
      expect(visibleSteps).toHaveLength(2);
    });

    it('filters steps based on condition', () => {
      const schema: FormSchema = {
        id: 'test-form',
        steps: [
          {
            id: 'step-1',
            title: 'User Type',
            fields: [
              {
                id: 'field-type',
                name: 'userType',
                type: 'select',
                options: [
                  { label: 'Individual', value: 'individual' },
                  { label: 'Business', value: 'business' },
                ],
              },
            ],
          },
          {
            id: 'step-2',
            title: 'Business Info',
            condition: { field: 'userType', operator: 'eq', value: 'business' },
            fields: [{ id: 'field-company', name: 'companyName', type: 'text' }],
          },
        ],
      };
      const form = buildForm(schema);

      const individualSteps = form.getVisibleSteps({ userType: 'individual' });
      expect(individualSteps).toHaveLength(1);
      expect(individualSteps[0].id).toBe('step-1');

      const businessSteps = form.getVisibleSteps({ userType: 'business' });
      expect(businessSteps).toHaveLength(2);
    });
  });

  describe('conditional field validation', () => {
    it('validates conditional fields only when condition is met', () => {
      const schema: FormSchema = {
        id: 'test-form',
        steps: [
          {
            id: 'step-1',
            title: 'Contact',
            fields: [
              {
                id: 'field-contact-method',
                name: 'contactMethod',
                type: 'select',
                options: [
                  { label: 'Email', value: 'email' },
                  { label: 'Phone', value: 'phone' },
                ],
                validation: {
                  validators: [{ id: 'v1', name: 'Required', predicate: 'required' }],
                },
              },
              {
                id: 'field-phone',
                name: 'phoneNumber',
                type: 'tel',
                condition: { field: 'contactMethod', operator: 'eq', value: 'phone' },
                validation: {
                  validators: [{ id: 'v2', name: 'Required', predicate: 'required' }],
                },
              },
            ],
          },
        ],
      };
      const form = buildForm(schema);

      // When contactMethod is 'email', phone is not required
      const emailResult = form.safeParse({ contactMethod: 'email' });
      expect(emailResult.success).toBe(true);

      // When contactMethod is 'phone', phone is required
      const phoneResult = form.safeParse({ contactMethod: 'phone' });
      expect(phoneResult.success).toBe(false);

      // When contactMethod is 'phone' and phone provided
      const phoneWithValueResult = form.safeParse({
        contactMethod: 'phone',
        phoneNumber: '010-1234-5678',
      });
      expect(phoneWithValueResult.success).toBe(true);
    });
  });

  describe('legacy schema support', () => {
    it('normalizes flat field schemas into a single-step form', () => {
      const schema = normalizeFormSchema({
        fields: [
          {
            name: 'email',
            label: 'Email',
            type: 'email',
            required: true,
          },
        ],
      });

      expect(schema.steps).toHaveLength(1);
      expect(schema.steps[0]).toMatchObject({
        title: 'Form',
        fields: [
          {
            name: 'email',
            label: 'Email',
            type: 'email',
          },
        ],
      });
      expect(schema.steps[0].fields?.[0].validation?.validators).toEqual([
        expect.objectContaining({ predicate: 'required' }),
      ]);
    });

    it('builds legacy schemas without throwing and preserves field keys', () => {
      const form = buildForm({
        fields: [
          {
            name: 'name',
            label: 'Name',
            type: 'text',
            required: true,
          },
          {
            name: 'email',
            label: 'Email',
            type: 'email',
          },
        ],
      });

      expect(form.schema.steps).toHaveLength(1);
      expect(form.schema.steps[0].fields?.map((field) => field.name)).toEqual(['name', 'email']);
      expect(form.schema.steps[0].fields?.map((field) => field.label)).toEqual(['Name', 'Email']);
      expect(form.safeParse({ name: 'Alice', email: 'alice@example.com' }).success).toBe(true);
      expect(form.safeParse({ name: '', email: 'alice@example.com' }).success).toBe(false);
    });
  });

  describe('current schema normalization', () => {
    it('keeps untitled steps valid and defaults showTitle to true', () => {
      const schema = normalizeFormSchema({
        id: 'schema-1',
        steps: [
          {
            id: 'step-1',
            title: '',
            fields: [],
          },
        ],
      } satisfies FormSchema);

      expect(schema.steps[0]).toMatchObject({
        id: 'step-1',
        title: undefined,
        showTitle: true,
      });
    });

    it('passes localized validation messages through buildForm', () => {
      const form = buildForm(
        {
          id: 'schema-1',
          steps: [
            {
              id: 'step-1',
              fields: [
                {
                  id: 'field-email',
                  key: 'email',
                  label: 'Email',
                  type: 'email',
                  validation: {
                    validators: [{ id: 'validator-email', name: 'Required', predicate: 'required' }],
                  },
                },
              ],
            },
          ],
        },
        {
          validationMessages: {
            ...defaultFormValidationMessages,
            invalidEmail: '유효한 이메일 주소를 입력하세요',
          },
        },
      );

      const result = form.safeParse({ email: 'invalid-email' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issueMessage = (result.error as { issues?: Array<{ message?: string }> }).issues?.[0]?.message;
        expect(issueMessage).toBe('유효한 이메일 주소를 입력하세요');
      }
    });
  });
});
