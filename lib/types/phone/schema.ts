/**
 * Phone-related type guards and utilities
 */

import { isSupportedCountry, type CountryCode } from 'libphonenumber-js';

/**
 * Type guard to check if a value is a valid CountryCode
 */
function isValidCountryCode(code: unknown): code is CountryCode {
  return typeof code === 'string' && isSupportedCountry(code);
}

/**
 * Convert a string to CountryCode with fallback
 */
export function toCountryCode(code: string, fallback: CountryCode = 'US'): CountryCode {
  return isValidCountryCode(code) ? code : fallback;
}
