'use client';

import { Box, Text } from '@mantine/core';
import { TextInput } from '@/components/core/Input';
import { toStringValue } from '@/lib/types/form/guards';
import type { FormFieldSchemaText } from '@/lib/types/form/schema';
import { parseMarkdown } from '@/lib/utils/parse-markdown';
import { FieldFooter } from '../FieldFooter';
import { inputStyles } from '../styles';
import { getFieldLabel, getFieldLimits } from '../utils';

export interface TextFieldProps {
  field: FormFieldSchemaText;
  value: unknown;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  error?: string;
  isRequired: boolean;
}

export function TextField({ field, value, onChange, onFocus, onBlur, error, isRequired }: TextFieldProps) {
  const isEmail = field.type === 'email';
  const inputId = `field-${field.id}`;
  const errorId = `${inputId}-error`;
  const descriptionId = field.description ? `${inputId}-description` : undefined;

  const stringValue = toStringValue(value);
  const { min, max: schemaMax } = getFieldLimits(field);
  const defaultMax = isEmail ? 254 : 500;
  const max = schemaMax ?? defaultMax;

  return (
    <Box>
      <TextInput
        id={inputId}
        label={parseMarkdown(getFieldLabel(field))}
        description={field.description ? parseMarkdown(field.description) : undefined}
        type={isEmail ? 'email' : 'text'}
        placeholder={field.placeholder ?? (isEmail ? 'example@email.com' : undefined)}
        value={stringValue}
        onChange={(e) => onChange(e.currentTarget.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        error={Boolean(error)}
        withAsterisk={isRequired}
        styles={inputStyles}
        aria-describedby={[descriptionId, error ? errorId : undefined].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? true : undefined}
      />
      <FieldFooter
        error={error}
        errorId={errorId}
        right={
          <Text size="xs" c="dimmed" ta="right" style={{ whiteSpace: 'nowrap' }}>
            {stringValue.length} / {max}
            {min !== undefined && ` (min ${min})`}
          </Text>
        }
      />
    </Box>
  );
}
