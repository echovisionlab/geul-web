'use client';

import { Text as DsText } from '@/components/core/Typography';
import { useState } from 'react';

import { TextInput } from '@/components/core/Input';
import type { FormFieldSchemaNumber } from '@/lib/types/form/schema';
import { parseMarkdown } from '@/lib/utils/parse-markdown';
import { FieldFooter } from '../FieldFooter';
import { getFieldLabel, getFieldLimits } from '../utils';
import { getFormatError, parseNumber } from './numberUtils';

export interface NumberFieldProps {
  field: FormFieldSchemaNumber;
  value: unknown;
  disabled?: boolean;
  onChange: (value: number | undefined) => void;
  onFocus: () => void;
  onBlur: () => void;
  error?: string;
  isRequired: boolean;
}

export function NumberField({
  field,
  disabled,
  value,
  onChange,
  onFocus,
  onBlur,
  error,
  isRequired,
}: NumberFieldProps) {
  const inputId = `field-${field.id}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
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

    // A cleared/invalid input must not leave the previous valid number
    // in the submitted record while the displayed value says otherwise.
    const parsed = raw !== '' && raw !== '-' && !getFormatError(raw, config) ? parseNumber(raw, config) : null;
    onChange(parsed ?? undefined);
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
    <div>
      <TextInput
        disabled={disabled}
        id={inputId}
        label={parseMarkdown(getFieldLabel(field))}
        required={isRequired}
        description={field.description ? <span id={descriptionId}>{parseMarkdown(field.description)}</span> : undefined}
        placeholder={field.placeholder}
        value={displayValue}
        onChange={handleChange}
        onFocus={onFocus}
        onBlur={handleBlur}
        error={Boolean(displayError)}
        inputMode={isInteger ? 'numeric' : 'decimal'}
        aria-describedby={
          [
            descriptionId,
            showRange || isInteger || field.numberType === 'float' ? hintId : undefined,
            displayError ? errorId : undefined,
          ]
            .filter(Boolean)
            .join(' ') || undefined
        }
        aria-invalid={displayError ? true : undefined}
      />
      <FieldFooter
        rightId={hintId}
        error={displayError}
        errorId={errorId}
        right={
          hints.length > 0 ? (
            <DsText size="xs" tone="secondary" align="end" nowrap>
              {hints.join(' · ')}
            </DsText>
          ) : null
        }
      />
    </div>
  );
}
