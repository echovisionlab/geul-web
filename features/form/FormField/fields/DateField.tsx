'use client';

import { Text as DsText } from '@/components/core/Typography';

import { TextInput } from '@/components/core/Input';
import type { FormFieldSchemaDate } from '@/lib/types/form/schema';
import { parseMarkdown } from '@/lib/utils/parse-markdown';
import { getTimezoneLabel } from '@/lib/utils/timezone';
import { FieldFooter } from '../FieldFooter';
import { getFieldLabel } from '../utils';

export interface DateFieldProps {
  field: FormFieldSchemaDate;
  value: unknown;
  disabled?: boolean;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  error?: string;
  isRequired: boolean;
}

export function DateField({ field, disabled, value, onChange, onFocus, onBlur, error, isRequired }: DateFieldProps) {
  const inputId = `field-${field.id}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const descriptionId = field.description ? `${inputId}-description` : undefined;

  // Convert value to string for the input
  const stringValue = typeof value === 'string' ? value : '';

  // Timezone display
  const tzDisplay = field.timezone ? getTimezoneLabel(field.timezone) : null;

  return (
    <div>
      <TextInput
        disabled={disabled}
        id={inputId}
        type="date"
        label={parseMarkdown(getFieldLabel(field))}
        required={isRequired}
        description={field.description ? <span id={descriptionId}>{parseMarkdown(field.description)}</span> : undefined}
        placeholder={field.placeholder ?? 'YYYY-MM-DD'}
        value={stringValue}
        onChange={(e) => onChange(e.currentTarget.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        error={Boolean(error)}
        min={field.minDate}
        max={field.maxDate}
        aria-describedby={
          [descriptionId, tzDisplay ? hintId : undefined, error ? errorId : undefined].filter(Boolean).join(' ') ||
          undefined
        }
        aria-invalid={error ? true : undefined}
      />
      <FieldFooter
        rightId={hintId}
        error={error}
        errorId={errorId}
        right={
          tzDisplay ? (
            <DsText size="xs" tone="secondary" align="end" nowrap>
              Timezone: {tzDisplay}
            </DsText>
          ) : null
        }
      />
    </div>
  );
}
