import { z } from 'zod';

/**
 * Boolean stored as string for Yjs serialization compatibility.
 */
const booleanString = z.enum(['true', 'false']);

/**
 * Columns block props schema.
 */
export const columnsSchema = z.object({
  columns: z.enum(['2', '3', '4']).default('2'),
  gap: z.string().default('24'),
  columnRatios: z.string().default('1:1'),
  mobileStack: booleanString.default('true'),
});

export type ColumnsProps = z.infer<typeof columnsSchema>;

/**
 * Parse and validate columns props with defaults applied.
 */
export function parseColumnsProps(data: unknown): ColumnsProps {
  return columnsSchema.parse(data ?? {});
}
