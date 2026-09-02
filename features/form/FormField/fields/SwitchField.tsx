'use client';

import { Input } from '@mantine/core';
import { Switch } from '@/components/core/Input';
import { toBooleanValue } from '@/lib/types/form/guards';
import type { FormFieldSchemaSwitch } from '@/lib/types/form/schema';
import { parseMarkdown } from '@/lib/utils/parse-markdown';
import { inputStyles } from '../styles';
import { getFieldLabel } from '../utils';

export interface SwitchFieldProps {
  field: FormFieldSchemaSwitch;
  value: unknown;
  onChange: (value: boolean) => void;
  onFocus: () => void;
  onBlur: () => void;
}

export function SwitchField({ field, value, onChange, onFocus, onBlur }: SwitchFieldProps) {
  const switchId = `field-${field.id}`;

  return (
    <Input.Wrapper
      label={parseMarkdown(getFieldLabel(field))}
      description={field.description ? parseMarkdown(field.description) : undefined}
      styles={inputStyles}
    >
      <Switch
        id={switchId}
        checked={toBooleanValue(value)}
        onChange={(e) => {
          onChange(e.currentTarget.checked);
          requestAnimationFrame(() => onBlur());
        }}
        onFocus={onFocus}
        mt="xs"
      />
    </Input.Wrapper>
  );
}
