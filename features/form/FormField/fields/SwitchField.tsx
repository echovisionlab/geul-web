'use client';

import { VisuallyHidden } from '@/components/core/Typography';
import { Field } from '@/components/core/Field';
import { Switch } from '@/components/core/Input';
import { toBooleanValue } from '@/lib/types/form/guards';
import type { FormFieldSchemaSwitch } from '@/lib/types/form/schema';
import { parseMarkdown } from '@/lib/utils/parse-markdown';
import { getFieldLabel } from '../utils';

export interface SwitchFieldProps {
  field: FormFieldSchemaSwitch;
  value: unknown;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  onFocus: () => void;
  onBlur: () => void;
  error?: string;
  isRequired?: boolean;
}

export function SwitchField({
  field,
  disabled,
  value,
  onChange,
  onFocus,
  onBlur,
  error,
  isRequired,
}: SwitchFieldProps) {
  const switchId = `field-${field.id}`;

  return (
    <>
      <Field
        label={parseMarkdown(getFieldLabel(field))}
        description={field.description ? parseMarkdown(field.description) : undefined}
      >
        <Switch
          disabled={disabled}
          id={switchId}
          required={isRequired}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${switchId}-validation` : undefined}
          checked={toBooleanValue(value)}
          onChange={(e) => {
            onChange(e.currentTarget.checked);
            requestAnimationFrame(() => onBlur());
          }}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </Field>
      {error ? <VisuallyHidden id={`${switchId}-validation`}>{error}</VisuallyHidden> : null}
    </>
  );
}
