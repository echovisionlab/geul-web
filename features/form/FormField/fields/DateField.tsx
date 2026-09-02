'use client';

import { Box, Text } from '@mantine/core';
import { TextInput } from '@/components/core/Input';
import type { FormFieldSchemaDate } from '@/lib/types/form/schema';
import { parseMarkdown } from '@/lib/utils/parse-markdown';
import { getTimezoneLabel } from '@/lib/utils/timezone';
import { FieldFooter } from '../FieldFooter';
import { inputStyles } from '../styles';
import { getFieldLabel } from '../utils';

export interface DateFieldProps {
  field: FormFieldSchemaDate;
  value: unknown;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  error?: string;
  isRequired: boolean;
}

export function DateField({ field, value, onChange, onFocus, onBlur, error, isRequired }: DateFieldProps) {
  const inputId = `field-${field.id}`;
  const errorId = `${inputId}-error`;
  const descriptionId = field.description ? `${inputId}-description` : undefined;

  // Convert value to string for the input
  const stringValue = typeof value === 'string' ? value : '';

  // Timezone display
  const tzDisplay = field.timezone ? getTimezoneLabel(field.timezone) : null;

  return (
    <Box>
      <TextInput
        id={inputId}
        type="date"
        label={parseMarkdown(getFieldLabel(field))}
        description={field.description ? parseMarkdown(field.description) : undefined}
        placeholder={field.placeholder ?? 'YYYY-MM-DD'}
        value={stringValue}
        onChange={(e) => onChange(e.currentTarget.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        error={Boolean(error)}
        withAsterisk={isRequired}
        min={field.minDate}
        max={field.maxDate}
        styles={inputStyles}
        aria-describedby={[descriptionId, error ? errorId : undefined].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? true : undefined}
      />
      <FieldFooter
        error={error}
        errorId={errorId}
        right={
          tzDisplay ? (
            <Text size="xs" c="dimmed" ta="right" style={{ whiteSpace: 'nowrap' }}>
              Timezone: {tzDisplay}
            </Text>
          ) : null
        }
      />
    </Box>
  );
}
