// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import type { FormFieldSchema } from '@/lib/types/form/schema';
import { StepConditionEditor } from './ConditionEditor';

const base = { id: 'target-field', key: 'target', label: 'Response target' };
// Cover each comparison control, including the boolean option labels.
const fields: FormFieldSchema[] = [
  { ...base, type: 'text' },
  { ...base, type: 'number' },
  { ...base, type: 'date' },
  { ...base, type: 'select', options: [{ label: 'First option', value: 'first' }] },
  { ...base, type: 'checkbox' },
];

describe('condition editing', () => {
  it.each(fields)('names field, operator and $type comparison inputs', (field) => {
    render(
      <StepConditionEditor
        condition={{ fieldId: field.id, operator: 'eq', value: '' }}
        availableFields={[{ field, label: field.label ?? '', value: field.id }]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Fields' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Operator' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Condition' })).toContainElement(screen.getByLabelText('Value'));
  });
});
