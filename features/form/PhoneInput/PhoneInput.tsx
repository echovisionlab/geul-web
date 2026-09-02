'use client';

import { forwardRef, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { PhoneInputView, type PhoneInputCountryOption, type TextInputProps } from '@/components/core/Input';
import { usePhoneInput } from '@/lib/hooks/usePhoneInput';

export interface PhoneInputProps extends Omit<TextInputProps, 'defaultValue' | 'onChange' | 'value'> {
  defaultCountry?: string;
  defaultValue?: string;
  onPhoneChange?: (value: string, countryCode: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  showErrorText?: boolean;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ defaultCountry, defaultValue, onPhoneChange, onFocus, onBlur, showErrorText = true, ...inputProps }, ref) => {
    const t = useTranslations('phoneInput');
    const tCommonPlaceholders = useTranslations('common.placeholders');
    const { countries, countryCode, setCountryCode, value, setValue, placeholder } = usePhoneInput({
      defaultCountry,
      defaultValue,
    });
    const onPhoneChangeRef = useRef(onPhoneChange);
    const countryOptions = useMemo<PhoneInputCountryOption[]>(
      () =>
        countries.map(({ code, name, flag, dialCode }) => ({
          code,
          name,
          flag,
          dialCode,
        })),
      [countries],
    );

    useEffect(() => {
      onPhoneChangeRef.current = onPhoneChange;
    });

    useEffect(() => {
      onPhoneChangeRef.current?.(value, countryCode);
    }, [value, countryCode]);

    const handleCountryChange = useCallback(
      (code: string) => {
        setCountryCode(code);
      },
      [setCountryCode],
    );

    const handleValueChange = useCallback(
      (nextValue: string) => {
        setValue(nextValue);
      },
      [setValue],
    );

    return (
      <PhoneInputView
        ref={ref}
        countries={countryOptions}
        countryCode={countryCode}
        value={value}
        phonePlaceholder={placeholder}
        labels={{
          searchPlaceholder: tCommonPlaceholders('search'),
          noResults: t('noResults'),
        }}
        onCountryChange={handleCountryChange}
        onValueChange={handleValueChange}
        onFocus={onFocus}
        onBlur={onBlur}
        showErrorText={showErrorText}
        {...inputProps}
      />
    );
  },
);

PhoneInput.displayName = 'PhoneInput';
