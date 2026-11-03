// @vitest-environment jsdom

import type { ReactElement } from 'react';
import { act, render, screen, waitFor } from '@/test/render';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormField } from './FormField';
import { loadPhoneField } from './load-phone-field';
import type {
  FormFieldSchemaCheckbox,
  FormFieldSchemaDate,
  FormFieldSchemaMultiSelect,
  FormFieldSchemaNumber,
  FormFieldSchemaPhone,
  FormFieldSchemaSelect,
  FormFieldSchemaText,
} from '@/lib/types/form/schema';
import { CheckboxField } from './fields/CheckboxField';
import { DateField } from './fields/DateField';
import { MultiSelectField } from './fields/MultiSelectField';
import { NumberField } from './fields/NumberField';
import { PhoneField } from './fields/PhoneField';
import { SelectField } from './fields/SelectField';
import { TextareaField } from './fields/TextareaField';
import { TextField } from './fields/TextField';

vi.mock('./load-phone-field', () => ({ loadPhoneField: vi.fn() }));
let view: ReturnType<typeof render> | undefined;
afterEach(() => {
  view = undefined;
  vi.mocked(loadPhoneField).mockReset();
});
function renderField(node: ReactElement) {
  view?.unmount();
  view = render(node);
  return view;
}
function expectSingleError(message: string) {
  expect(screen.getAllByText(message)).toHaveLength(1);
}

describe('form field error rendering', () => {
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
    expect(screen.getByRole('textbox', { name: 'Textarea' })).toHaveAttribute('rows', '1');

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

it('preserves the phone field label while its chunk loads and offers recovery after a failure', async () => {
  const pending = Promise.withResolvers<typeof import('./fields/PhoneField')>();
  vi.mocked(loadPhoneField).mockReturnValueOnce(pending.promise).mockResolvedValueOnce({ PhoneField });
  const field = { id: 'phone-pending', type: 'tel' as const, label: 'Phone', description: 'Contact number' };
  const { user } = renderField(
    <FormField field={field} value={undefined} onChange={vi.fn()} onValidityChange={vi.fn()} />,
  );
  expect(screen.getByRole('textbox', { name: 'Phone' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Loading...');
  await act(async () => pending.reject(new Error('Chunk offline')));
  expect(screen.getByRole('alert')).toHaveTextContent('Failed to load data.');
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Phone' })).not.toBeDisabled());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText('Contact number')).toBeInTheDocument();
});
