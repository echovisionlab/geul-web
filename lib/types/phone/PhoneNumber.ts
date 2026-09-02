/**
 * PhoneNumber class for type-safe phone number handling
 */

import {
  ParseError,
  parsePhoneNumberWithError,
  type CountryCode,
  type PhoneNumber as LibPhoneNumber,
} from 'libphonenumber-js';
import { z } from 'zod';
import { toCountryCode } from './schema';

// =============================================================================
// Zod Schema
// =============================================================================

export const phoneNumberDataSchema = z.object({
  phone: z.string(),
  countryCode: z.string(),
});

export type PhoneNumberData = z.infer<typeof phoneNumberDataSchema>;

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

    const result = phoneNumberDataSchema.safeParse(value);
    if (result.success) {
      return new PhoneNumber(result.data.phone, result.data.countryCode);
    }

    if (typeof value === 'string') {
      return new PhoneNumber(value, defaultCountry);
    }

    return new PhoneNumber('', defaultCountry);
  }

  // =============================================================================
  // Zod Schema with Transform
  // =============================================================================

  static schema = phoneNumberDataSchema.transform((data) => PhoneNumber.fromJSON(data));
}
