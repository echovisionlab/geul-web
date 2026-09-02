'use client';

import { Input } from '@mantine/core';
import { Checkbox } from '@/components/core/Input';
import { toBooleanValue } from '@/lib/types/form/guards';
import type { FormFieldSchemaCheckbox } from '@/lib/types/form/schema';
import { parseMarkdown } from '@/lib/utils/parse-markdown';
import { inputStyles } from '../styles';
import { getFieldLabel } from '../utils';

export interface CheckboxFieldProps {
  field: FormFieldSchemaCheckbox;
  value: unknown;
  onChange: (value: boolean) => void;
  onFocus: () => void;
  onBlur: () => void;
  error?: string;
  isRequired: boolean;
}

export function CheckboxField({ field, value, onChange, onFocus, onBlur, error, isRequired }: CheckboxFieldProps) {
  return (
    <Input.Wrapper
      label={parseMarkdown(getFieldLabel(field))}
      description={field.description ? parseMarkdown(field.description) : undefined}
      error={error}
      withAsterisk={isRequired}
      styles={inputStyles}
    >
      <Checkbox
        checked={toBooleanValue(value)}
        onChange={(e) => {
          onChange(e.currentTarget.checked);
          requestAnimationFrame(() => onBlur());
        }}
        onFocus={onFocus}
        label={field.checkboxLabel ? parseMarkdown(field.checkboxLabel) : undefined}
        mt="xs"
      />
    </Input.Wrapper>
  );
}
