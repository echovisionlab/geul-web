// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  FormFieldSchemaCheckbox,
  FormFieldSchemaDate,
  FormFieldSchemaMultiSelect,
  FormFieldSchemaNumber,
  FormFieldSchemaPhone,
  FormFieldSchemaSelect,
  FormFieldSchemaText,
} from '@/lib/types/form/schema';
import { TestProviders } from '@/test/TestProviders';
import { CheckboxField } from './fields/CheckboxField';
import { DateField } from './fields/DateField';
import { MultiSelectField } from './fields/MultiSelectField';
import { NumberField } from './fields/NumberField';
import { PhoneField } from './fields/PhoneField';
import { SelectField } from './fields/SelectField';
import { TextareaField } from './fields/TextareaField';
import { TextField } from './fields/TextField';
import { formErrorTextStyles, groupStyles, inputStyles } from './styles';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

function renderField(node: ReactNode) {
  act(() => {
    root?.unmount();
  });
  container?.remove();

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<TestProviders>{node}</TestProviders>);
  });
}

function expectSingleError(message: string) {
  const textContent = container?.textContent ?? '';
  const occurrences = textContent.split(message).length - 1;
  expect(occurrences).toBe(1);
}

describe('form field error rendering', () => {
  it('uses Mantine error token for shared form error text styles', () => {
    expect(formErrorTextStyles.color).toBe('var(--mantine-color-error)');
    expect(inputStyles.error.color).toBe('var(--mantine-color-error)');
    expect(groupStyles.error.color).toBe('var(--mantine-color-error)');
  });

  it('renders each field error message once', () => {
    const textField: FormFieldSchemaText = {
      id: 'text',
      name: 'text',
      type: 'text',
      label: 'Text',
    };
    renderField(
      <TextField
        field={textField}
        value=""
        onChange={() => {}}
        onFocus={() => {}}
        onBlur={() => {}}
        error="__TEXT_ERROR__"
        isRequired
      />,
    );
    expectSingleError('__TEXT_ERROR__');

    const textareaField: FormFieldSchemaText = {
      id: 'textarea',
      name: 'textarea',
      type: 'textarea',
      label: 'Textarea',
    };
    renderField(
      <TextareaField
        field={textareaField}
        value=""
        onChange={() => {}}
        onFocus={() => {}}
        onBlur={() => {}}
        error="__TEXTAREA_ERROR__"
        isRequired
      />,
    );
    expectSingleError('__TEXTAREA_ERROR__');
    expect(container?.querySelector('textarea')?.getAttribute('rows')).toBe('1');

    const numberField: FormFieldSchemaNumber = {
      id: 'number',
      name: 'number',
      type: 'number',
      label: 'Number',
    };
    renderField(
      <NumberField
        field={numberField}
        value={undefined}
        onChange={() => {}}
        onFocus={() => {}}
        onBlur={() => {}}
        error="__NUMBER_ERROR__"
        isRequired
      />,
    );
    expectSingleError('__NUMBER_ERROR__');

    const dateField: FormFieldSchemaDate = {
      id: 'date',
      name: 'date',
      type: 'date',
      label: 'Date',
    };
    renderField(
      <DateField
        field={dateField}
        value=""
        onChange={() => {}}
        onFocus={() => {}}
        onBlur={() => {}}
        error="__DATE_ERROR__"
        isRequired
      />,
    );
    expectSingleError('__DATE_ERROR__');

    const selectField: FormFieldSchemaSelect = {
      id: 'select',
      name: 'select',
      type: 'select',
      label: 'Select',
      options: [{ label: 'Option 1', value: 'one' }],
    };
    renderField(
      <SelectField
        field={selectField}
        value=""
        onChange={() => {}}
        onFocus={() => {}}
        onBlur={() => {}}
        error="__SELECT_ERROR__"
        isRequired
      />,
    );
    expectSingleError('__SELECT_ERROR__');

    const multiSelectField: FormFieldSchemaMultiSelect = {
      id: 'multiselect',
      name: 'multiselect',
      type: 'multiselect',
      label: 'Multi Select',
      options: [{ label: 'Option 1', value: 'one' }],
    };
    renderField(
      <MultiSelectField
        field={multiSelectField}
        value={[]}
        onChange={() => {}}
        onFocus={() => {}}
        onBlur={() => {}}
        error="__MULTISELECT_ERROR__"
        isRequired
      />,
    );
    expectSingleError('__MULTISELECT_ERROR__');

    const checkboxField: FormFieldSchemaCheckbox = {
      id: 'checkbox',
      name: 'checkbox',
      type: 'checkbox',
      label: 'Checkbox',
    };
    renderField(
      <CheckboxField
        field={checkboxField}
        value={false}
        onChange={() => {}}
        onFocus={() => {}}
        onBlur={() => {}}
        error="__CHECKBOX_ERROR__"
        isRequired
      />,
    );
    expectSingleError('__CHECKBOX_ERROR__');

    const phoneField: FormFieldSchemaPhone = {
      id: 'phone',
      name: 'phone',
      type: 'tel',
      label: 'Phone',
    };
    renderField(
      <PhoneField
        field={phoneField}
        value={undefined}
        onChange={() => {}}
        onFocus={() => {}}
        onBlur={() => {}}
        error="__PHONE_ERROR__"
        isRequired
      />,
    );
    expectSingleError('__PHONE_ERROR__');
  });
});
