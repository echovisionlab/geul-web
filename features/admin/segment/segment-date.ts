import * as z from '@/lib/zod-mini';

const dateToISO = z.pipe(
  z.coerce.date(),
  z.transform((d: Date) => d.toISOString()),
);

/** Normalizes a date picker value to an ISO timestamp, or '' when it is empty or not a valid date. */
export function coerceDateValue(value: unknown): string {
  if (!value) {
    return '';
  }
  const result = dateToISO.safeParse(value);
  return result.success ? result.data : '';
}
