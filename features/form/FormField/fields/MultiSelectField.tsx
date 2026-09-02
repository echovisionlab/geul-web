'use client';

import { MultiSelect } from '@/components/core/Input';
import { toStringArrayValue } from '@/lib/types/form/guards';
import type { FormFieldSchemaMultiSelect } from '@/lib/types/form/schema';
import { parseMarkdown } from '@/lib/utils/parse-markdown';
import { inputStyles } from '../styles';
import { getFieldLabel } from '../utils';

export interface MultiSelectFieldProps {
  field: FormFieldSchemaMultiSelect;
  value: unknown;
  onChange: (value: string[]) => void;
  onFocus: () => void;
  onBlur: () => void;
  error?: string;
  isRequired: boolean;
}

export function MultiSelectField({
  field,
  value,
  onChange,
  onFocus,
  onBlur,
  error,
  isRequired,
}: MultiSelectFieldProps) {
  return (
    <MultiSelect
      label={parseMarkdown(getFieldLabel(field))}
      description={field.description ? parseMarkdown(field.description) : undefined}
      placeholder={field.placeholder}
      data={field.options.map((o) => ({ value: o.value, label: o.label }))}
      value={toStringArrayValue(value)}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      error={error}
      withAsterisk={isRequired}
      searchable
      clearable
      styles={inputStyles}
    />
  );
}
