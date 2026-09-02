'use client';

import { useCallback, useEffect, useState } from 'react';
import { AsYouType } from 'libphonenumber-js/min';
import {
  DEFAULT_COUNTRY_CODE,
  getCountryByCode,
  PHONE_COUNTRIES,
  type PhoneCountry,
} from '@/lib/constants/phone-countries';
import { toCountryCode } from '@/lib/types/phone/schema';

export interface UsePhoneInputOptions {
  defaultCountry?: string;
  defaultValue?: string;
}

export interface UsePhoneInputReturn {
  countries: PhoneCountry[];
  country: PhoneCountry;
  countryCode: string;
  setCountryCode: (code: string) => void;
  value: string;
  setValue: (value: string) => void;
  placeholder: string;
  reset: () => void;
}

export function usePhoneInput(options: UsePhoneInputOptions = {}): UsePhoneInputReturn {
  const { defaultCountry, defaultValue = '' } = options;

  const [countryCode, setCountryCode] = useState(defaultCountry ?? DEFAULT_COUNTRY_CODE);
  const [value, setValue] = useState(defaultValue);

  const country = getCountryByCode(countryCode) ?? PHONE_COUNTRIES[0];

  // Format input as user types
  const formatValue = useCallback(
    (input: string): string => {
      if (!input) {
        return '';
      }
      const formatter = new AsYouType(toCountryCode(countryCode));
      return formatter.input(input);
    },
    [countryCode],
  );

  const handleSetValue = useCallback(
    (input: string) => {
      setValue(formatValue(input));
    },
    [formatValue],
  );

  const reset = useCallback(() => {
    setValue(formatValue(defaultValue));
    setCountryCode(defaultCountry ?? DEFAULT_COUNTRY_CODE);
  }, [defaultValue, defaultCountry, formatValue]);

  const handleSetCountryCode = useCallback(
    (code: string) => {
      setCountryCode(code);
      // Re-format value with new country code
      if (value) {
        const formatter = new AsYouType(toCountryCode(code));
        setValue(formatter.input(value.replace(/\D/g, '')));
      }
    },
    [value],
  );

  // Format initial value on mount
  useEffect(() => {
    if (defaultValue) {
      setValue(formatValue(defaultValue));
    }
  }, []);

  return {
    countries: PHONE_COUNTRIES,
    country,
    countryCode,
    setCountryCode: handleSetCountryCode,
    value,
    setValue: handleSetValue,
    placeholder: country.placeholder,
    reset,
  };
}
