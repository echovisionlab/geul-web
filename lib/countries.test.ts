import { describe, expect, it } from 'vitest';
import {
  buildCountrySelectOptions,
  COUNTRY_SELECT_OPTIONS,
  formatCountryDisplayName,
  searchCountrySelectOptions,
} from './countries';

describe('country catalog helpers', () => {
  it('finds countries by ISO code', () => {
    const results = searchCountrySelectOptions('KR');

    expect(results.some((option) => option.code === 'KR')).toBe(true);
  });

  it('finds countries by English name', () => {
    const results = searchCountrySelectOptions('switzerland');

    expect(results.some((option) => option.code === 'CH')).toBe(true);
  });

  it('finds countries by native name', () => {
    const results = searchCountrySelectOptions('대한민국');

    expect(results.some((option) => option.code === 'KR')).toBe(true);
  });

  it('keeps the full catalog available when search is empty', () => {
    expect(searchCountrySelectOptions('')).toHaveLength(COUNTRY_SELECT_OPTIONS.length);
  });

  it('formats display names for the requested UI locale', () => {
    expect(formatCountryDisplayName('KR', 'ko')).toBe('대한민국');
    expect(formatCountryDisplayName('KR', 'en')).toBe('South Korea');
  });

  it('builds select option labels from localized display names', () => {
    const options = buildCountrySelectOptions('ko');
    const korea = options.find((option) => option.code === 'KR');

    expect(korea?.label).toBe('대한민국');
    expect(searchCountrySelectOptions('south korea', options).some((option) => option.code === 'KR')).toBe(true);
  });
});
