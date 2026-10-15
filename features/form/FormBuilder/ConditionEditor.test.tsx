// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { within } from 'storybook/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import type { FormFieldSchema } from '@/lib/types/form/schema';
import { StepConditionEditor } from './ConditionEditor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});
let root: Root | undefined;
let container: HTMLDivElement | undefined;
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});
const base = { id: 'target-field', key: 'target', label: 'Response target' };
const fields: FormFieldSchema[] = [
  { ...base, type: 'text' },
  { ...base, type: 'email' },
  { ...base, type: 'textarea' },
  { ...base, type: 'number' },
  { ...base, type: 'date' },
  { ...base, type: 'tel' },
  { ...base, type: 'select', options: [{ label: 'First option', value: 'first' }] },
  { ...base, type: 'multiselect', options: [{ label: 'First option', value: 'first' }] },
  { ...base, type: 'checkbox' },
  { ...base, type: 'switch' },
];
describe('condition editing', () => {
  it.each(fields)('names field, operator and $type comparison inputs', (field) => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() =>
      root?.render(
        <TestProviders>
          <StepConditionEditor
            condition={{ fieldId: field.id, operator: 'eq', value: '' }}
            availableFields={[{ field, label: field.label ?? '', value: field.id }]}
            onChange={vi.fn()}
          />
        </TestProviders>,
      ),
    );
    const canvas = within(container);
    expect(canvas.getByRole('combobox', { name: 'Fields' })).toBeTruthy();
    expect(canvas.getByRole('combobox', { name: 'Operator' })).toBeTruthy();
    expect(canvas.getByLabelText('Value')).toBeTruthy();
    const group = canvas.getByRole('group', { name: 'Condition' });
    expect(group.contains(canvas.getByLabelText('Value'))).toBe(true);
  });
});
