'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { useTranslations } from 'next-intl';
import { useFormValidationMessages } from '@/features/form/useFormValidationMessages';
import { isEmpty, validateWithZod } from '@/lib/form/validation-core';
import { isPhoneValueEmpty } from '@/lib/types/phone/phone-number-data';
import type { FormFieldSchema } from '@/lib/types/form/schema';

export interface UseFieldValidationOptions {
  field: FormFieldSchema;
  value: unknown;
  debounceMs?: number;
}

export interface UseFieldValidationReturn {
  isValid: boolean | null;
  error: string | null;
  isValidating: boolean;
}

/**
 * Check if field type needs debounced validation
 * - Email type fields need debounce (auto email validation)
 * - Text fields with format rules (url, regex, comparison) need debounce
 * - Phone fields need debounce (parsing cost)
 * - Select, checkbox, boolean are immediate
 */
function needsDebounce(field: FormFieldSchema): boolean {
  if (field.type === 'tel') {
    return true;
  }
  if (field.type === 'email') {
    return true;
  }
  if (field.type === 'select' || field.type === 'multiselect') {
    return false;
  }
  if (field.type === 'switch' || field.type === 'checkbox') {
    return false;
  }

  const validators = field.validation?.validators ?? [];
  const hasFormatValidators = validators.some(
    (v) =>
      v.predicate === 'email' ||
      v.predicate === 'url' ||
      v.predicate === 'regex' ||
      v.predicate === 'gt' ||
      v.predicate === 'gte' ||
      v.predicate === 'lt' ||
      v.predicate === 'lte' ||
      v.predicate === 'eq',
  );
  return hasFormatValidators;
}

export function useFieldValidation({
  field,
  value,
  debounceMs = 150,
}: UseFieldValidationOptions): UseFieldValidationReturn {
  const validationMessages = useFormValidationMessages();
  const tCommon = useTranslations('common.messages');
  const shouldDebounce = useMemo(() => needsDebounce(field), [field]);
  const [debouncedValue] = useDebouncedValue(value, shouldDebounce ? debounceMs : 0);

  const valueForRequired = value;
  const valueForFormat = debouncedValue;

  const [state, setState] = useState<UseFieldValidationReturn>({
    isValid: null,
    error: null,
    isValidating: false,
  });

  // Immediate validation: required check
  useEffect(() => {
    const validators = field.validation?.validators ?? [];
    const isRequired = validators.some((v) => v.predicate === 'required');
    const requiredMessage = validators.find((v) => v.predicate === 'required')?.message ?? validationMessages.required;

    // For phone, check empty immediately
    if (field.type === 'tel') {
      const phoneIsEmpty = isPhoneValueEmpty(valueForRequired);
      if (phoneIsEmpty) {
        setState({
          isValid: !isRequired,
          error: isRequired ? requiredMessage : null,
          isValidating: shouldDebounce && !phoneIsEmpty,
        });
        return;
      }
      setState((prev) => ({ ...prev, isValidating: true }));
      return;
    }

    // For other fields, check empty immediately
    if (isEmpty(valueForRequired)) {
      setState({
        isValid: !isRequired,
        error: isRequired ? requiredMessage : null,
        isValidating: false,
      });
      return;
    }

    if (shouldDebounce) {
      setState((prev) => ({ ...prev, isValidating: true }));
      return;
    }

    const zodResult = validateWithZod(field, valueForRequired, validationMessages);
    setState({
      isValid: zodResult.success,
      error: zodResult.error ?? null,
      isValidating: false,
    });
  }, [valueForRequired, field, shouldDebounce, validationMessages]);

  // Debounced validation: format rules
  useEffect(() => {
    if (!shouldDebounce) {
      return;
    }
    if (valueForFormat !== valueForRequired || isEmpty(valueForFormat)) {
      return;
    }

    // Phone validation using PhoneNumber class. `libphonenumber-js` loads with the first phone field
    // (PhoneField imports the same module), so forms without one do not download it.
    if (field.type === 'tel') {
      if (isPhoneValueEmpty(valueForFormat)) {
        return;
      }

      let current = true;
      void import('@/lib/types/phone/PhoneNumber')
        .then(({ extractPhoneValue }) => {
          if (!current) {
            return;
          }
          const phoneNumber = extractPhoneValue(valueForFormat, field.defaultCountry);
          setState({
            isValid: phoneNumber.isValid,
            error: phoneNumber.isValid ? null : validationMessages.invalidPhoneNumber,
            isValidating: false,
          });
        })
        .catch(() => {
          if (!current) {
            return;
          }
          setState({ isValid: false, error: tCommon('failedToLoad'), isValidating: false });
        });
      return () => {
        current = false;
      };
    }

    const zodResult = validateWithZod(field, valueForFormat, validationMessages);
    setState({
      isValid: zodResult.success,
      error: zodResult.error ?? null,
      isValidating: false,
    });
  }, [valueForFormat, valueForRequired, field, shouldDebounce, validationMessages, tCommon]);

  return state;
}
