'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { SelectProps } from '@/components/core/Input';
import { buildCountrySelectOptions, filterCountrySelectOptions } from '@/lib/countries';
import { CountrySelect } from './ui/CountrySelect';

export interface CountryCodeSelectProps extends Omit<
  SelectProps,
  'data' | 'filter' | 'renderOption' | 'onChange' | 'value'
> {
  value: string;
  onChange: (value: string) => void;
}

/** Supplies localized country data to the pure country-select UI. */
export function CountryCodeSelect({
  value,
  onChange,
  searchable = true,
  clearable = true,
  ...props
}: CountryCodeSelectProps) {
  const locale = useLocale();
  const tSearchCombobox = useTranslations('searchCombobox');
  const countryOptions = useMemo(() => buildCountrySelectOptions(locale), [locale]);

  return (
    <CountrySelect
      {...props}
      searchable={searchable}
      clearable={clearable}
      options={countryOptions}
      value={value || null}
      onChange={(nextValue) => onChange(nextValue ?? '')}
      filter={filterCountrySelectOptions}
      noResultsLabel={tSearchCombobox('noResults')}
    />
  );
}
