'use client';

import { Stack } from '@mantine/core';
import { Radio } from '@/components/core/Input';
import { toStringValue } from '@/lib/types/form/guards';
import type { FormFieldSchemaSelect } from '@/lib/types/form/schema';
import { parseMarkdown } from '@/lib/utils/parse-markdown';
import { groupStyles } from '../styles';
import { getFieldLabel } from '../utils';

export interface SelectFieldProps {
  field: FormFieldSchemaSelect;
  value: unknown;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  error?: string;
  isRequired: boolean;
}

export function SelectField({ field, value, onChange, onFocus, onBlur, error, isRequired }: SelectFieldProps) {
  return (
    <Radio.Group
      label={parseMarkdown(getFieldLabel(field))}
      description={field.description ? parseMarkdown(field.description) : undefined}
      value={toStringValue(value)}
      onChange={(val) => {
        onChange(val);
        requestAnimationFrame(() => onBlur());
      }}
      onFocus={onFocus}
      error={error}
      withAsterisk={isRequired}
      styles={groupStyles}
    >
      <Stack gap="xs" mt="xs">
        {field.options.map((option, index) => (
          <Radio key={`${option.value}-${index}`} value={option.value} label={option.label} />
        ))}
      </Stack>
    </Radio.Group>
  );
}
