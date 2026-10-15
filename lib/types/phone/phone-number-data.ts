/**
 * Phone field value shape without `libphonenumber-js`, so form code can check and store phone values
 * without loading the phone metadata. Parsing and validation live in `PhoneNumber.ts`.
 */

import * as z from '@/lib/zod-mini';

export const phoneNumberDataSchema = z.object({
  phone: z.string(),
  countryCode: z.string(),
});

export type PhoneNumberData = z.infer<typeof phoneNumberDataSchema>;

/** The `{ phone, countryCode }` that `PhoneNumber.fromUnknown` would parse from `value`. */
export function phoneNumberDataFromUnknown(value: unknown, defaultCountry: string = 'US'): PhoneNumberData {
  const result = phoneNumberDataSchema.safeParse(value);
  if (result.success) {
    return { phone: result.data.phone, countryCode: result.data.countryCode };
  }
  if (typeof value === 'string') {
    return { phone: value, countryCode: defaultCountry };
  }
  return { phone: '', countryCode: defaultCountry };
}

/** Same as `PhoneNumber.fromUnknown(value).isEmpty`. */
export function isPhoneValueEmpty(value: unknown): boolean {
  return !phoneNumberDataFromUnknown(value).phone.trim();
}
