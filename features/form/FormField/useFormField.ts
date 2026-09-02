'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFieldValidation } from '@/features/form/useFieldValidation';
import type { FormFieldSchema } from '@/lib/types/form/schema';

export interface UseFormFieldOptions {
  field: FormFieldSchema;
  value: unknown;
  onValidityChange: (isValid: boolean | null) => void;
}

export interface UseFormFieldReturn {
  isRequired: boolean;
  touched: boolean;
  focused: boolean;
  setTouched: () => void;
  setFocused: (focused: boolean) => void;
  displayError: string | undefined;
}

export function useFormField({ field, value, onValidityChange }: UseFormFieldOptions): UseFormFieldReturn {
  const isRequired = field.validation?.validators?.some((v) => v.predicate === 'required') ?? false;
  const [touched, setTouchedState] = useState(false);
  const [focused, setFocusedState] = useState(false);

  const { isValid, error, isValidating } = useFieldValidation({
    field,
    value,
  });

  const onValidityChangeRef = useRef(onValidityChange);
  useEffect(() => {
    onValidityChangeRef.current = onValidityChange;
  });

  useEffect(() => {
    onValidityChangeRef.current(isValidating ? null : isValid);
  }, [isValid, isValidating]);

  const setTouched = useCallback(() => {
    setTouchedState(true);
  }, []);

  const setFocused = useCallback((isFocused: boolean) => {
    setFocusedState(isFocused);
    if (!isFocused) {
      setTouchedState(true);
    }
  }, []);

  // Show error only when touched AND not currently focused (typing)
  const displayError = touched && !focused ? (error ?? undefined) : undefined;

  return {
    isRequired,
    touched,
    focused,
    setTouched,
    setFocused,
    displayError,
  };
}
