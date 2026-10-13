import { componentBindings } from '@/components/core/bindings';
import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';

import { Select, type SelectProps } from '@/components/core/Input';

export interface CountrySelectOption {
  value: string;
  label: string;
  code: string;
  name: string;
  nativeName?: string;
}

export interface CountrySelectProps extends Omit<SelectProps, 'data' | 'renderOption' | 'nothingFoundMessage'> {
  options: CountrySelectOption[];
  noResultsLabel: string;
}

/** Pure localized-country option presentation. */
export function CountrySelect({ options, noResultsLabel, ...props }: CountrySelectProps) {
  return (
    <Select
      {...componentBindings(props)}
      data={options}
      getSearchText={(option) => {
        const country = options.find((country) => country.value === option.value);
        return [option.label, country?.name, country?.nativeName, country?.code].filter(Boolean).join(' ');
      }}
      nothingFoundMessage={noResultsLabel}
      renderOption={({ option }) => {
        const country = option as CountrySelectOption;
        return (
          <DsLayoutInline gap="xs" wrap="nowrap" justify="between">
            <DsLayoutInline gap="xs" wrap="nowrap">
              <DsText as="span">{country.name}</DsText>
              <DsText as="span" size="sm" tone="secondary">
                {country.code}
              </DsText>
            </DsLayoutInline>
            {country.nativeName && country.nativeName !== country.name ? (
              <DsText as="span" size="sm" tone="secondary">
                {country.nativeName}
              </DsText>
            ) : null}
          </DsLayoutInline>
        );
      }}
    />
  );
}
