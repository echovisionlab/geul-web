'use client';

import { Text as DsText } from '@/components/core/Typography';

import { TextInput } from '@/components/core/Input';
import { toStringValue } from '@/lib/types/form/guards';
import type { FormFieldSchemaText } from '@/lib/types/form/schema';
import { parseMarkdown } from '@/lib/utils/parse-markdown';
import { FieldFooter } from '../FieldFooter';
import { getFieldLabel, getFieldLimits } from '../utils';

export interface TextFieldProps {
  field: FormFieldSchemaText;
  value: unknown;
  disabled?: boolean;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  error?: string;
  isRequired: boolean;
}

export function TextField({ field, disabled, value, onChange, onFocus, onBlur, error, isRequired }: TextFieldProps) {
  const isEmail = field.type === 'email';
  const inputId = `field-${field.id}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const descriptionId = field.description ? `${inputId}-description` : undefined;

  const stringValue = toStringValue(value);
  const { min, max: schemaMax } = getFieldLimits(field);
  const defaultMax = isEmail ? 254 : 500;
  const max = schemaMax ?? defaultMax;

  return (
    <div>
      <TextInput
        disabled={disabled}
        id={inputId}
        label={parseMarkdown(getFieldLabel(field))}
        required={isRequired}
        description={field.description ? <span id={descriptionId}>{parseMarkdown(field.description)}</span> : undefined}
        type={isEmail ? 'email' : 'text'}
        placeholder={field.placeholder ?? (isEmail ? 'example@email.com' : undefined)}
        value={stringValue}
        onChange={(e) => onChange(e.currentTarget.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        error={Boolean(error)}
        aria-describedby={[descriptionId, hintId, error ? errorId : undefined].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? true : undefined}
      />
      <FieldFooter
        rightId={hintId}
        error={error}
        errorId={errorId}
        right={
          <DsText size="xs" tone="secondary" align="end" nowrap>
            {stringValue.length} / {max}
            {min !== undefined && ` (min ${min})`}
          </DsText>
        }
      />
    </div>
  );
}
