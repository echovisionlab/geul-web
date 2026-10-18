import { describe, expect, it } from 'vitest';
import { formSchemaZod, type FormSchema } from './schema';

const storedForm: FormSchema = {
  id: 'form-1',
  steps: [
    {
      id: 'step-1',
      title: 'Step',
      showTitle: true,
      fields: [
        {
          id: 'f1',
          type: 'text',
          key: 'name',
          validation: { validators: [{ id: 'v1', name: 'Required', predicate: 'required', message: 'Enter a name' }] },
        },
        { id: 'f2', type: 'tel', defaultCountry: 'KR', showValidationIcon: false },
        { id: 'f3', type: 'number', numberType: 'float', decimalPlaces: 2 },
        { id: 'f4', type: 'select', options: [{ id: 'o1', label: 'One', value: '1' }] },
        { id: 'f5', type: 'checkbox', checkboxLabel: 'Agree' },
        { id: 'f6', type: 'date', minDate: '2020-01-01', timezone: 'Asia/Seoul' },
        { id: 'f7', type: 'switch', condition: { fieldId: 'f1', operator: 'exists' } },
      ],
    },
    {
      id: 'step-2',
      condition: {
        logic: 'and',
        conditions: [
          { fieldId: 'f1', operator: 'eq', value: 'x' },
          { logic: 'or', conditions: [{ fieldId: 'f3', operator: 'gt', value: 2 }] },
        ],
      },
      fields: [{ id: 'f8', type: 'multiselect', options: [{ id: 'o2', label: 'Two', value: '2' }] }],
    },
  ],
};

function storedStep(step: Record<string, unknown>) {
  return { id: 'form-1', steps: [{ id: 'step-1', ...step }] };
}

describe('stored form schema', () => {
  it('reads a stored multi-step form without losing fields, validators or conditions', () => {
    expect(formSchemaZod.parse(storedForm)).toEqual(storedForm);
  });

  it('reads legacy field names and condition.field aliases', () => {
    const legacy = storedStep({
      fields: [
        { id: 'f1', type: 'email', name: 'email' },
        { id: 'f2', type: 'switch', condition: { field: 'email', operator: 'exists' } },
      ],
    });
    expect(formSchemaZod.parse(legacy)).toEqual(legacy);
  });

  it.each([
    ['no steps', { id: 'form-1' }],
    ['an unknown field type', storedStep({ fields: [{ id: 'f', type: 'rating' }] })],
    ['more than ten decimal places', storedStep({ fields: [{ id: 'f', type: 'number', decimalPlaces: 11 }] })],
    ['fractional decimal places', storedStep({ fields: [{ id: 'f', type: 'number', decimalPlaces: 1.5 }] })],
    [
      'a choice without a label',
      storedStep({ fields: [{ id: 'f', type: 'select', options: [{ id: 'o', value: 'v' }] }] }),
    ],
    [
      'a validator without a predicate',
      storedStep({ fields: [{ id: 'f', type: 'text', validation: { validators: [{ id: 'v', name: 'n' }] } }] }),
    ],
    ['an unknown condition logic', storedStep({ condition: { logic: 'xor', conditions: [] } })],
    ['an unknown condition operator', storedStep({ condition: { fieldId: 'f', operator: 'between', value: 1 } })],
  ])('rejects a stored form with %s', (_, form) => {
    expect(formSchemaZod.safeParse(form).success).toBe(false);
  });
});
