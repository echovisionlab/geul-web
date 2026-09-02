'use client';

import { forwardRef, useCallback, useState, type ChangeEvent } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { Combobox, Group, Input, InputBase, ScrollArea, Text, useCombobox } from '@mantine/core';
import { TextInput, type TextInputProps } from './TextInput';

export interface PhoneInputCountryOption {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
}

export interface PhoneInputViewLabels {
  searchPlaceholder: string;
  noResults: string;
}

export interface PhoneInputViewProps extends Omit<TextInputProps, 'defaultValue' | 'onChange' | 'value'> {
  countries: readonly PhoneInputCountryOption[];
  countryCode: string;
  value: string;
  phonePlaceholder?: string;
  labels: PhoneInputViewLabels;
  onCountryChange: (countryCode: string) => void;
  onValueChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  showErrorText?: boolean;
}

function CountryOption({ country, selected }: { country: PhoneInputCountryOption; selected: boolean }) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Text>{country.flag}</Text>
      <Text size="sm" flex={1}>
        {country.name}
      </Text>
      <Text size="xs" c="dimmed">
        {country.dialCode}
      </Text>
      {selected ? <IconCheck size={14} /> : null}
    </Group>
  );
}

export const PhoneInputView = forwardRef<HTMLInputElement, PhoneInputViewProps>(
  (
    {
      countries,
      countryCode,
      value,
      phonePlaceholder,
      labels,
      onCountryChange,
      onValueChange,
      onFocus,
      onBlur,
      showErrorText = true,
      label,
      error,
      required,
      disabled,
      size = 'sm',
      ...inputProps
    },
    ref,
  ) => {
    const [search, setSearch] = useState('');
    const combobox = useCombobox({
      onDropdownClose: () => {
        combobox.resetSelectedOption();
        setSearch('');
      },
    });
    const selectedCountry = countries.find((country) => country.code === countryCode) ?? countries[0] ?? null;
    const normalizedSearch = search.trim().toLowerCase();
    const filteredCountries = normalizedSearch
      ? countries.filter(
          (country) =>
            country.name.toLowerCase().includes(normalizedSearch) ||
            country.code.toLowerCase().includes(normalizedSearch) ||
            country.dialCode.includes(normalizedSearch),
        )
      : countries;

    const handleCountrySelect = useCallback(
      (code: string) => {
        onCountryChange(code);
        combobox.closeDropdown();
      },
      [combobox, onCountryChange],
    );

    const handleInputChange = useCallback(
      (event: ChangeEvent<HTMLInputElement>) => {
        onValueChange(event.currentTarget.value);
      },
      [onValueChange],
    );

    return (
      <Input.Wrapper
        label={label}
        error={showErrorText ? error : undefined}
        required={required}
        size={size}
        styles={{ error: { marginTop: 8, color: 'var(--mantine-color-error)' } }}
      >
        <Group gap={0} wrap="nowrap">
          <Combobox store={combobox} onOptionSubmit={handleCountrySelect} withinPortal position="bottom-start">
            <Combobox.Target>
              <InputBase
                component="button"
                type="button"
                pointer
                rightSection={<Combobox.Chevron />}
                rightSectionPointerEvents="none"
                onClick={() => combobox.toggleDropdown()}
                disabled={disabled}
                size={size}
                style={{
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                  borderRight: 'none',
                  minWidth: 100,
                }}
              >
                {selectedCountry ? (
                  <Group gap="xs" wrap="nowrap">
                    <Text lh={1}>{selectedCountry.flag}</Text>
                    <Text size="sm">{selectedCountry.dialCode}</Text>
                  </Group>
                ) : null}
              </InputBase>
            </Combobox.Target>

            <Combobox.Dropdown miw={280}>
              <TextInput
                size="xs"
                placeholder={labels.searchPlaceholder}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                mb="xs"
              />
              <ScrollArea.Autosize mah={250} type="scroll">
                <Combobox.Options>
                  {filteredCountries.length > 0 ? (
                    filteredCountries.map((country) => (
                      <Combobox.Option key={country.code} value={country.code} active={country.code === countryCode}>
                        <CountryOption country={country} selected={country.code === countryCode} />
                      </Combobox.Option>
                    ))
                  ) : (
                    <Combobox.Empty>{labels.noResults}</Combobox.Empty>
                  )}
                </Combobox.Options>
              </ScrollArea.Autosize>
            </Combobox.Dropdown>
          </Combobox>

          <TextInput
            ref={ref}
            type="tel"
            value={value}
            onChange={handleInputChange}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={phonePlaceholder}
            disabled={disabled}
            size={size}
            error={!!error}
            style={{ flex: 1 }}
            styles={{
              input: {
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0,
              },
            }}
            {...inputProps}
          />
        </Group>
      </Input.Wrapper>
    );
  },
);

PhoneInputView.displayName = 'PhoneInputView';
