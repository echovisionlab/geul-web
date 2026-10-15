import * as z from '@/lib/zod-mini';

/**
 * Boolean stored as string for Yjs serialization compatibility.
 */
const booleanString = z.enum(['true', 'false']);

/**
 * Columns block props schema.
 */
export const columnsSchema = z.object({
  columns: z._default(z.enum(['2', '3', '4']), '2'),
  gap: z._default(z.string(), '24'),
  columnRatios: z._default(z.string(), '1:1'),
  mobileStack: z._default(booleanString, 'true'),
});

export type ColumnsProps = z.infer<typeof columnsSchema>;

/**
 * Parse and validate columns props with defaults applied.
 */
export function parseColumnsProps(data: unknown): ColumnsProps {
  return columnsSchema.parse(data ?? {});
}
