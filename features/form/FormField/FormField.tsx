'use client';

import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { FieldValue } from '@/lib/types/form/guards';
import type { FormFieldSchema } from '@/lib/types/form/schema';
import { CheckboxField } from './fields/CheckboxField';
import { DateField } from './fields/DateField';
import { MultiSelectField } from './fields/MultiSelectField';
import { NumberField } from './fields/NumberField';
import { SelectField } from './fields/SelectField';
import { SwitchField } from './fields/SwitchField';
import { TextareaField } from './fields/TextareaField';
import { TextField } from './fields/TextField';
import { loadPhoneField } from './load-phone-field';
import { useFormField } from './useFormField';

const PhoneField = dynamic(() => loadPhoneField().then((module) => module.PhoneField));

export interface FormFieldProps {
  field: FormFieldSchema;
  disabled?: boolean;
  phoneDefaultCountry?: string | null;
  value: FieldValue | undefined;
  onChange: (value: FieldValue | undefined) => void;
  onValidityChange: (isValid: boolean | null) => void;
}

export function FormField({ field, disabled, phoneDefaultCountry, value, onChange, onValidityChange }: FormFieldProps) {
  const { isRequired, setFocused, displayError } = useFormField({
    field,
    value,
    onValidityChange,
  });

  const onFocus = useCallback(() => setFocused(true), [setFocused]);
  const onBlur = useCallback(() => setFocused(false), [setFocused]);

  switch (field.type) {
    case 'text':
    case 'email':
      return (
        <TextField
          field={field}
          disabled={disabled}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          error={displayError}
          isRequired={isRequired}
        />
      );

    case 'tel':
      return (
        <PhoneField
          field={field}
          disabled={disabled}
          defaultCountry={phoneDefaultCountry}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          error={displayError}
          isRequired={isRequired}
        />
      );

    case 'textarea':
      return (
        <TextareaField
          field={field}
          disabled={disabled}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          error={displayError}
          isRequired={isRequired}
        />
      );

    case 'number':
      return (
        <NumberField
          field={field}
          disabled={disabled}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          error={displayError}
          isRequired={isRequired}
        />
      );

    case 'select':
      return (
        <SelectField
          field={field}
          disabled={disabled}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          error={displayError}
          isRequired={isRequired}
        />
      );

    case 'multiselect':
      return (
        <MultiSelectField
          field={field}
          disabled={disabled}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          error={displayError}
          isRequired={isRequired}
        />
      );

    case 'checkbox':
      return (
        <CheckboxField
          field={field}
          disabled={disabled}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          error={displayError}
          isRequired={isRequired}
        />
      );

    case 'switch':
      return (
        <SwitchField
          field={field}
          disabled={disabled}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          error={displayError}
          isRequired={isRequired}
        />
      );

    case 'date':
      return (
        <DateField
          field={field}
          disabled={disabled}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          error={displayError}
          isRequired={isRequired}
        />
      );

    default:
      return null;
  }
}
