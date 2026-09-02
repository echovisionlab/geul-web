import { describe, expect, it } from 'vitest';
import type { FormSchema } from '@/lib/types/form/schema';
import { validateCanonicalFormSchemaForPersistence } from './schema-persistence';

describe('validateCanonicalFormSchemaForPersistence', () => {
  it('accepts a valid canonical schema', () => {
    const schema: FormSchema = {
      id: 'schema-1',
      steps: [
        {
          id: 'step-1',
          showTitle: true,
          title: 'Contact',
          fields: [
            {
              id: 'field-email',
              key: 'email',
              type: 'email',
            },
          ],
        },
      ],
    };

    expect(validateCanonicalFormSchemaForPersistence(schema)).toMatchObject({
      valid: true,
      issues: [],
      fieldKeyIssues: {},
    });
  });

  it('rejects duplicate field keys', () => {
    const schema: FormSchema = {
      id: 'schema-1',
      steps: [
        {
          id: 'step-1',
          fields: [
            { id: 'field-email', key: 'email', type: 'email' },
            { id: 'field-email-confirm', key: 'email', type: 'email' },
          ],
        },
      ],
    };

    const result = validateCanonicalFormSchemaForPersistence(schema);

    expect(result.valid).toBe(false);
    expect(result.fieldKeyIssues).toEqual({
      'field-email-confirm': 'field.key.duplicate',
    });
  });

  it('rejects missing field keys', () => {
    const schema: FormSchema = {
      id: 'schema-1',
      steps: [
        {
          id: 'step-1',
          fields: [{ id: 'field-email', type: 'email' }],
        },
      ],
    };

    const result = validateCanonicalFormSchemaForPersistence(schema);

    expect(result.valid).toBe(false);
    expect(result.fieldKeyIssues).toEqual({
      'field-email': 'field.key.required',
    });
  });

  it('accepts legacy field.name keys and legacy condition.field aliases', () => {
    const schema: FormSchema = {
      id: 'schema-1',
      steps: [
        {
          id: 'step-1',
          fields: [
            { id: 'field-email', name: 'email', type: 'email' },
            {
              id: 'field-message',
              key: 'message',
              type: 'textarea',
              condition: {
                field: 'field-email',
                operator: 'exists',
              },
            },
          ],
          condition: {
            field: 'field-email',
            operator: 'exists',
          },
        },
      ],
    };

    expect(validateCanonicalFormSchemaForPersistence(schema)).toMatchObject({
      valid: true,
      issues: [],
      fieldKeyIssues: {},
    });
  });

  it('rejects duplicate option ids and option values within the same field', () => {
    const schema: FormSchema = {
      id: 'schema-1',
      steps: [
        {
          id: 'step-1',
          fields: [
            {
              id: 'field-type',
              key: 'type',
              type: 'select',
              options: [
                { id: 'option-1', value: 'artwork', label: 'Artwork' },
                { id: 'option-1', value: 'recording', label: 'Recording' },
                { id: 'option-3', value: 'recording', label: 'Duplicate value' },
              ],
            },
          ],
        },
      ],
    };

    const result = validateCanonicalFormSchemaForPersistence(schema);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'option.id.duplicate',
          path: 'schema.steps[0].fields[0].options[1].id',
          fieldId: 'field-type',
        }),
        expect.objectContaining({
          code: 'option.value.duplicate',
          path: 'schema.steps[0].fields[0].options[2].value',
          fieldId: 'field-type',
        }),
      ]),
    );
  });

  it('rejects nested conditions that reference missing fields or omit field ids', () => {
    const schema: FormSchema = {
      id: 'schema-1',
      steps: [
        {
          id: 'step-1',
          condition: {
            logic: 'and',
            conditions: [
              { fieldId: '', operator: 'exists' },
              { fieldId: 'missing-field', operator: 'exists' },
            ],
          },
          fields: [{ id: 'field-email', key: 'email', type: 'email' }],
        },
      ],
    };

    const result = validateCanonicalFormSchemaForPersistence(schema);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'condition.fieldId.required',
          path: 'schema.steps[0].condition.conditions[0].fieldId',
        }),
        expect.objectContaining({
          code: 'condition.fieldId.missing',
          path: 'schema.steps[0].condition.conditions[1].fieldId',
        }),
      ]),
    );
  });
});
