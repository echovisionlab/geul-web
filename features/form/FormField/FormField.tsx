'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Field } from '@/components/core/Field';
import { TextInput } from '@/components/core/Input';
import { Spinner } from '@/components/core/Display';
import { Button } from '@/components/core/Button';
import { SupportingText } from '@/components/core/Typography';
import { parseMarkdown } from '@/lib/utils/parse-markdown';
import { getFieldLabel } from './utils';
import type { PhoneFieldProps } from './fields/PhoneField';
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

function PhoneField(props: PhoneFieldProps) {
  const t = useTranslations('common');
  const [component, setComponent] = useState<typeof import('./fields/PhoneField').PhoneField | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setFailed(false);
    void loadPhoneField().then(
      (module) => {
        if (current) {
          setComponent(() => module.PhoneField);
        }
      },
      () => {
        if (current) {
          setFailed(true);
        }
      },
    );
    return () => {
      current = false;
    };
  }, [attempt]);
  const ResolvedField = component;
  if (ResolvedField) {
    return <ResolvedField {...props} />;
  }
  return (
    <Field
      label={parseMarkdown(getFieldLabel(props.field))}
      description={props.field.description ? parseMarkdown(props.field.description) : undefined}
      required={props.isRequired}
      error={failed ? <span role="alert">{t('messages.failedToLoad')}</span> : undefined}
      actions={
        failed ? (
          <Button size="sm" onClick={() => setAttempt((value) => value + 1)}>
            {t('actions.tryAgain')}
          </Button>
        ) : undefined
      }
    >
      <TextInput
        type="tel"
        disabled
        aria-busy={!failed}
        rightSection={!failed ? <Spinner size="xs" /> : undefined}
        description={
          !failed ? (
            <SupportingText role="status" tone="secondary">
              {t('states.loading')}
            </SupportingText>
          ) : undefined
        }
      />
    </Field>
  );
}

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
