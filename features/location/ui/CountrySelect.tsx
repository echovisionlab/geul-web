import { Group, Text } from '@mantine/core';
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
      {...props}
      data={options}
      nothingFoundMessage={noResultsLabel}
      renderOption={({ option }) => {
        const country = option as CountrySelectOption;
        return (
          <Group gap="xs" wrap="nowrap" justify="space-between">
            <Group gap="xs" wrap="nowrap">
              <Text span>{country.name}</Text>
              <Text span size="sm" c="dimmed">
                {country.code}
              </Text>
            </Group>
            {country.nativeName && country.nativeName !== country.name ? (
              <Text span size="sm" c="dimmed">
                {country.nativeName}
              </Text>
            ) : null}
          </Group>
        );
      }}
    />
  );
}
