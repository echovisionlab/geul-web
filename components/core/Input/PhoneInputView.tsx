'use client';
import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from './TextInput';
import { Select } from './Select';
import classes from './Input.module.css';
export interface PhoneInputCountryOption {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
}
export interface PhoneInputViewLabels {
  countryName: string;
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
  showErrorText?: boolean;
}
export const PhoneInputView = forwardRef<HTMLInputElement, PhoneInputViewProps>((props, ref) => (
  <div className={classes.phone}>
    <Select
      label={props.label ? props.labels.searchPlaceholder : undefined}
      aria-label={props.labels.countryName}
      searchable
      data={props.countries.map((country) => ({
        value: country.code,
        label: `${country.flag} ${country.name} ${country.dialCode}`,
      }))}
      value={props.countryCode}
      onChange={(value) => {
        if (value) {
          props.onCountryChange(value);
        }
      }}
      disabled={props.disabled}
      readOnly={props.readOnly}
      size={props.size}
      nothingFoundMessage={props.labels.noResults}
    />
    <TextInput
      {...props}
      ref={ref}
      type="tel"
      value={props.value}
      placeholder={props.phonePlaceholder}
      error={props.showErrorText === false ? Boolean(props.error) : props.error}
      onChange={(event) => props.onValueChange(event.currentTarget.value)}
    />
  </div>
));
PhoneInputView.displayName = 'PhoneInputView';
