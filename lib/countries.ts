import type { ComboboxItem, OptionsFilter } from '@mantine/core';
import { COUNTRY_CATALOG } from '@/lib/constants/countries.generated';

export interface CountrySelectOption extends ComboboxItem {
  code: string;
  name: string;
  englishName: string;
  nativeName: string;
  searchText: string;
}

const countryByCode = new Map(COUNTRY_CATALOG.map((country) => [country.code, country]));

function normalizeCountryCode(countryCode: string | null | undefined) {
  const code = countryCode?.trim().toUpperCase();
  return code || null;
}

export function formatCountryDisplayName(countryCode: string | null | undefined, locale: string | null | undefined) {
  const code = normalizeCountryCode(countryCode);
  if (!code) {
    return '';
  }

  try {
    const localizedName = new Intl.DisplayNames(locale ? [locale] : undefined, {
      type: 'region',
    }).of(code);

    if (localizedName && localizedName !== code) {
      return localizedName;
    }
  } catch {
    // Some runtimes may not have complete Intl.DisplayNames data.
  }

  return countryByCode.get(code)?.name ?? code;
}

export function buildCountrySelectOptions(locale: string | null | undefined) {
  return COUNTRY_CATALOG.map((country) => {
    const name = formatCountryDisplayName(country.code, locale);
    const searchText = `${country.searchText} ${name}`.toLowerCase();

    return {
      value: country.code,
      label: name,
      code: country.code,
      name,
      englishName: country.name,
      nativeName: country.nativeName,
      searchText,
    };
  });
}

export const COUNTRY_SELECT_OPTIONS: CountrySelectOption[] = buildCountrySelectOptions('en');

export function searchCountrySelectOptions(search: string, options: CountrySelectOption[] = COUNTRY_SELECT_OPTIONS) {
  const normalizedQuery = search.trim().toLowerCase();

  if (!normalizedQuery) {
    return options;
  }

  return options.filter((option) => option.searchText.includes(normalizedQuery));
}

export const filterCountrySelectOptions: OptionsFilter = ({ options, search }) => {
  return searchCountrySelectOptions(search, options as CountrySelectOption[]);
};
