'use client';

import { Field } from '@/components/core/Field';
import { Checkbox } from '@/components/core/Input';
import { toBooleanValue } from '@/lib/types/form/guards';
import type { FormFieldSchemaCheckbox } from '@/lib/types/form/schema';
import { parseMarkdown } from '@/lib/utils/parse-markdown';
import { getFieldLabel } from '../utils';

export interface CheckboxFieldProps {
  field: FormFieldSchemaCheckbox;
  value: unknown;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  onFocus: () => void;
  onBlur: () => void;
  error?: string;
  isRequired: boolean;
}

export function CheckboxField({
  field,
  disabled,
  value,
  onChange,
  onFocus,
  onBlur,
  error,
  isRequired,
}: CheckboxFieldProps) {
  return (
    <Field
      label={parseMarkdown(getFieldLabel(field))}
      description={field.description ? parseMarkdown(field.description) : undefined}
      error={error}
      required={isRequired}
    >
      <Checkbox
        disabled={disabled}
        checked={toBooleanValue(value)}
        onChange={(e) => {
          onChange(e.currentTarget.checked);
          requestAnimationFrame(() => onBlur());
        }}
        onFocus={onFocus}
        onBlur={onBlur}
        label={field.checkboxLabel ? parseMarkdown(field.checkboxLabel) : undefined}
      />
    </Field>
  );
}
