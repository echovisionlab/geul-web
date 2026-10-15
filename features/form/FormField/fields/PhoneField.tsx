'use client';

import { Field } from '@/components/core/Field';
import { PhoneInput } from '@/features/form/PhoneInput';
import { DEFAULT_COUNTRY_CODE } from '@/lib/constants/phone-countries';
import { extractPhoneValue } from '@/lib/types/phone/PhoneNumber';
import type { FormFieldSchemaPhone } from '@/lib/types/form/schema';
import { parseMarkdown } from '@/lib/utils/parse-markdown';
import { getFieldLabel } from '../utils';

export interface PhoneFieldProps {
  field: FormFieldSchemaPhone;
  defaultCountry?: string | null;
  value: unknown;
  disabled?: boolean;
  onChange: (value: { phone: string; countryCode: string }) => void;
  onFocus: () => void;
  onBlur: () => void;
  error?: string;
  isRequired: boolean;
}

export function PhoneField({
  field,
  disabled,
  defaultCountry,
  value,
  onChange,
  onFocus,
  onBlur,
  error,
  isRequired,
}: PhoneFieldProps) {
  const phoneNumber = extractPhoneValue(value, field.defaultCountry ?? defaultCountry ?? DEFAULT_COUNTRY_CODE);

  return (
    <Field
      label={parseMarkdown(getFieldLabel(field))}
      description={field.description ? parseMarkdown(field.description) : undefined}
      error={error}
      required={isRequired}
    >
      <PhoneInput
        disabled={disabled}
        defaultCountry={phoneNumber.countryCode}
        defaultValue={phoneNumber.phone}
        onPhoneChange={(phone, countryCode) => onChange({ phone, countryCode })}
        onFocus={onFocus}
        onBlur={onBlur}
        error={error}
        showErrorText={false}
      />
    </Field>
  );
}
