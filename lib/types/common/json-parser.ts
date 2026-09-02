import type { z } from 'zod';

/**
 * Safely parse JSON field with zod schema
 * Returns defaultValue on failure
 */
export function parseJsonField<T>(value: unknown, schema: z.ZodType<T>, defaultValue: T): T {
  const result = schema.safeParse(value);
  return result.success ? result.data : defaultValue;
}
