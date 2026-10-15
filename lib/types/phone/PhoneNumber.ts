/**
 * PhoneNumber class for type-safe phone number handling
 */

import {
  ParseError,
  parsePhoneNumberWithError,
  type CountryCode,
  type PhoneNumber as LibPhoneNumber,
} from 'libphonenumber-js';
import { phoneNumberDataFromUnknown, phoneNumberDataSchema, type PhoneNumberData } from './phone-number-data';
import * as z from '@/lib/zod-mini';
import { toCountryCode } from './schema';

export { phoneNumberDataSchema, type PhoneNumberData };

// =============================================================================
// PhoneNumber Class
// =============================================================================

export class PhoneNumber implements PhoneNumberData {
  public readonly phone: string;
  public readonly countryCode: string;
  private parsed: LibPhoneNumber | null = null;

  constructor(phone: string, countryCode: string) {
    this.phone = phone;
    this.countryCode = countryCode;
    this.parse();
  }

  private parse(): void {
    if (!this.phone.trim()) {
      this.parsed = null;
      return;
    }
    try {
      this.parsed = parsePhoneNumberWithError(this.phone, toCountryCode(this.countryCode));
    } catch (e) {
      if (e instanceof ParseError) {
        this.parsed = null;
      } else {
        throw e;
      }
    }
  }

  get isValid(): boolean {
    return this.parsed?.isValid() ?? false;
  }

  get isEmpty(): boolean {
    return !this.phone.trim();
  }

  toE164(): string | null {
    return this.parsed?.format('E.164') ?? null;
  }

  toNational(): string | null {
    return this.parsed?.formatNational() ?? null;
  }

  toInternational(): string | null {
    return this.parsed?.formatInternational() ?? null;
  }

  getCountry(): CountryCode | undefined {
    return this.parsed?.country;
  }

  toString(): string {
    return this.toE164() ?? this.phone;
  }

  toJSON(): PhoneNumberData {
    return {
      phone: this.phone,
      countryCode: this.countryCode,
    };
  }

  // =============================================================================
  // Static Factory Methods
  // =============================================================================

  static fromJSON(data: PhoneNumberData): PhoneNumber {
    return new PhoneNumber(data.phone, data.countryCode);
  }

  static fromUnknown(value: unknown, defaultCountry: string = 'US'): PhoneNumber {
    if (value instanceof PhoneNumber) {
      return value;
    }

    const data = phoneNumberDataFromUnknown(value, defaultCountry);
    return new PhoneNumber(data.phone, data.countryCode);
  }

  // =============================================================================
  // Zod Schema with Transform
  // =============================================================================

  static schema = z.pipe(
    phoneNumberDataSchema,
    z.transform((data: PhoneNumberData) => PhoneNumber.fromJSON(data)),
  );
}

/**
 * Extract PhoneNumber from unknown value. Loads `libphonenumber-js`; form code that only needs the
 * value shape or an empty check uses `phone-number-data.ts`.
 */
export function extractPhoneValue(v: unknown, defaultCountry: string = 'US'): PhoneNumber {
  return PhoneNumber.fromUnknown(v, defaultCountry);
}
