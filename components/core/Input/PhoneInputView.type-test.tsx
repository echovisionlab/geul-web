import type { PhoneInputViewLabels } from './PhoneInputView';
export const countryLabels: PhoneInputViewLabels = {
  countryName: 'Country',
  searchPlaceholder: 'Search',
  noResults: 'No results',
};
// @ts-expect-error Search copy cannot substitute for the country control's purpose.
export const unnamedCountry: PhoneInputViewLabels = { searchPlaceholder: 'Search', noResults: 'No results' };
