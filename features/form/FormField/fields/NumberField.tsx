'use client';

import { useState } from 'react';
import { Box, Text } from '@mantine/core';
import { TextInput } from '@/components/core/Input';
import type { FormFieldSchemaNumber } from '@/lib/types/form/schema';
import { parseMarkdown } from '@/lib/utils/parse-markdown';
import { FieldFooter } from '../FieldFooter';
import { inputStyles } from '../styles';
import { getFieldLabel, getFieldLimits } from '../utils';
import { getFormatError, parseNumber } from './numberUtils';

export interface NumberFieldProps {
  field: FormFieldSchemaNumber;
  value: unknown;
  onChange: (value: number) => void;
  onFocus: () => void;
  onBlur: () => void;
  error?: string;
  isRequired: boolean;
}

export function NumberField({ field, value, onChange, onFocus, onBlur, error, isRequired }: NumberFieldProps) {
  const inputId = `field-${field.id}`;
  const errorId = `${inputId}-error`;
  const descriptionId = field.description ? `${inputId}-description` : undefined;

  // Display value as string for text input
  const [displayValue, setDisplayValue] = useState(() => (value !== null && value !== undefined ? String(value) : ''));

  const { min, max } = getFieldLimits(field);
  const showRange = min !== undefined || max !== undefined;
  const isInteger = field.numberType === 'integer';
  const decimalPlaces = field.decimalPlaces ?? 2;
  const config = { numberType: field.numberType, decimalPlaces };

  const formatError = getFormatError(displayValue, config);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.currentTarget.value;
    setDisplayValue(raw);

    // Parse and notify parent for validation (skip empty/partial input)
    if (raw !== '' && raw !== '-' && !getFormatError(raw, config)) {
      const parsed = parseNumber(raw, config);
      if (parsed !== null) {
        onChange(parsed);
      }
    }
  };

  const handleBlur = () => {
    // Clean up display value on blur
    if (displayValue !== '' && displayValue !== '-') {
      const parsed = parseNumber(displayValue, config);
      if (parsed !== null) {
        setDisplayValue(String(parsed));
      }
    }
    onBlur();
  };

  const displayError = formatError || error;

  // Build hint text
  const hints: string[] = [];
  if (showRange) {
    if (min !== undefined && max !== undefined) {
      hints.push(`${min} ~ ${max}`);
    } else if (min !== undefined) {
      hints.push(`min ${min}`);
    } else if (max !== undefined) {
      hints.push(`max ${max}`);
    }
  }
  if (isInteger) {
    hints.push('integer');
  } else if (field.numberType === 'float') {
    hints.push(`${decimalPlaces} decimals`);
  }

  return (
    <Box>
      <TextInput
        id={inputId}
        label={parseMarkdown(getFieldLabel(field))}
        description={field.description ? parseMarkdown(field.description) : undefined}
        placeholder={field.placeholder}
        value={displayValue}
        onChange={handleChange}
        onFocus={onFocus}
        onBlur={handleBlur}
        error={Boolean(displayError)}
        withAsterisk={isRequired}
        inputMode={isInteger ? 'numeric' : 'decimal'}
        styles={inputStyles}
        aria-describedby={[descriptionId, displayError ? errorId : undefined].filter(Boolean).join(' ') || undefined}
        aria-invalid={displayError ? true : undefined}
      />
      <FieldFooter
        error={displayError}
        errorId={errorId}
        right={
          hints.length > 0 ? (
            <Text size="xs" c="dimmed" ta="right" style={{ whiteSpace: 'nowrap' }}>
              {hints.join(' · ')}
            </Text>
          ) : null
        }
      />
    </Box>
  );
}
