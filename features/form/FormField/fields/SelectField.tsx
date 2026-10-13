'use client';

import { LayoutStack as DsLayoutStack, LayoutInset as DsLayoutInset } from '@/components/core/Layout';

import { Radio } from '@/components/core/Input';
import { toStringValue } from '@/lib/types/form/guards';
import type { FormFieldSchemaSelect } from '@/lib/types/form/schema';
import { parseMarkdown } from '@/lib/utils/parse-markdown';
import { getFieldLabel } from '../utils';

export interface SelectFieldProps {
  field: FormFieldSchemaSelect;
  value: unknown;
  disabled?: boolean;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  error?: string;
  isRequired: boolean;
}

export function SelectField({
  field,
  disabled,
  value,
  onChange,
  onFocus,
  onBlur,
  error,
  isRequired,
}: SelectFieldProps) {
  return (
    <Radio.Group
      disabled={disabled}
      label={parseMarkdown(getFieldLabel(field))}
      required={isRequired}
      description={field.description ? parseMarkdown(field.description) : undefined}
      value={toStringValue(value)}
      onChange={(val) => {
        onChange(val);
        requestAnimationFrame(() => onBlur());
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      error={error}
    >
      <DsLayoutInset blockStart="xs">
        <DsLayoutStack gap="xs">
          {field.options.map((option, index) => (
            <Radio key={`${option.value}-${index}`} value={option.value} label={option.label} />
          ))}
        </DsLayoutStack>
      </DsLayoutInset>
    </Radio.Group>
  );
}
