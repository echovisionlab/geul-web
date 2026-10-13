/**
 * Type guards and Zod schemas for form field values
 */

import * as z from '@/lib/zod-mini';
import { phoneNumberDataSchema } from '@/lib/types/phone/phone-number-data';

// =============================================================================
// Zod Schemas
// =============================================================================

const stringSchema = z.string();
const numberSchema = z.number();
const booleanSchema = z.boolean();
const stringArraySchema = z.array(z.string());

export const fieldValueSchema = z.union([
  stringSchema,
  numberSchema,
  booleanSchema,
  stringArraySchema,
  phoneNumberDataSchema,
]);

export const formValuesSchema = z.record(z.string(), fieldValueSchema);

// =============================================================================
// Types (inferred from Zod)
// =============================================================================

export type FieldValue = z.infer<typeof fieldValueSchema>;
export type FormValues = z.infer<typeof formValuesSchema>;

// =============================================================================
// Type Guards
// =============================================================================

export function isString(v: unknown): v is string {
  return stringSchema.safeParse(v).success;
}

export function isBoolean(v: unknown): v is boolean {
  return booleanSchema.safeParse(v).success;
}

export function isStringArray(v: unknown): v is string[] {
  return stringArraySchema.safeParse(v).success;
}

// =============================================================================
// Value Extractors (with Zod catch for fallback)
// =============================================================================

const stringWithFallback = z.catch(z.string(), '');
const booleanWithFallback = z.catch(z.boolean(), false);
const stringArrayWithFallback = z.catch(z.array(z.string()), []);

export function toStringValue(v: unknown): string {
  return stringWithFallback.parse(v);
}

export function toBooleanValue(v: unknown): boolean {
  return booleanWithFallback.parse(v);
}

export function toStringArrayValue(v: unknown): string[] {
  return stringArrayWithFallback.parse(v);
}
