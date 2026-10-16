// @vitest-environment jsdom
import { fireEvent, within, waitFor } from 'storybook/test';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import type { FormFieldSchema } from '@/lib/types/form/schema';
import { FormField } from './FormField';
import { NumberField } from './fields/NumberField';
import { loadPhoneField } from './load-phone-field';

let root: Root | undefined;
let container: HTMLDivElement | undefined;
const screen = within(document.body);
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});
async function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(node));
}
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});
const base = { id: 'field-contract', key: 'answer', label: 'Response label', description: 'Field explanation' };
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
describe('production form field semantics', () => {
  it.each(fields)('names and relates the $type control without changing its label', async (field) => {
    // Await the real chunk before mounting the dynamic control so cold module
    // work cannot resolve between the render and assertion act boundaries.
    if (field.type === 'tel') {
      await loadPhoneField();
    }
    await render(
      <TestProviders>
        <FormField field={field} value={undefined} onChange={() => {}} onValidityChange={() => {}} />
      </TestProviders>,
    );
    const role =
      field.type === 'select'
        ? 'radiogroup'
        : field.type === 'multiselect'
          ? 'combobox'
          : field.type === 'checkbox'
            ? 'checkbox'
            : field.type === 'switch'
              ? 'switch'
              : field.type === 'date'
                ? null
                : 'textbox';
    // The phone field (with libphonenumber-js) is loaded on demand.
    const control = role
      ? await waitFor(async () => {
          await act(async () => {
            await Promise.resolve();
          });
          return screen.getByRole(role, { name: 'Response label' });
        })
      : screen.getByLabelText('Response label');
    await waitFor(() => {
      const references = control.getAttribute('aria-describedby')?.split(/\s+/) ?? [];
      expect(references.length).toBeGreaterThan(0);
      for (const id of references) {
        expect(document.getElementById(id)).not.toBeNull();
      }
      expect(references.map((id) => document.getElementById(id)?.textContent).join(' ')).toContain('Field explanation');
    });
    expect(screen.getAllByText('Response label')).toHaveLength(1);
  });

  it('exposes required switch validation without adding visible words or required marks', async () => {
    await render(
      <TestProviders>
        <FormField
          field={{
            ...base,
            type: 'switch',
            validation: {
              validators: [
                { id: 'required', name: 'Required', predicate: 'required', message: 'This answer is required' },
              ],
            },
          }}
          value={undefined}
          onChange={() => {}}
          onValidityChange={() => {}}
        />
      </TestProviders>,
    );
    const control = screen.getByRole('switch', { name: 'Response label' });
    expect(control.getAttribute('aria-required')).toBe('true');
    await act(async () => control.focus());
    await act(async () => control.blur());
    await waitFor(() => expect(control.getAttribute('aria-invalid')).toBe('true'));
    const descriptions = control
      .getAttribute('aria-describedby')
      ?.split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent)
      .join(' ');
    expect(descriptions).toContain('This answer is required');
  });

  it('clears the submitted number when its displayed input is cleared', async () => {
    const onChange = vi.fn();
    await render(
      <TestProviders>
        <NumberField
          field={{ ...base, type: 'number' }}
          value={12}
          onChange={onChange}
          onFocus={() => {}}
          onBlur={() => {}}
          isRequired
        />
      </TestProviders>,
    );
    await act(async () => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Response label' }), { target: { value: '' } });
    });
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});
