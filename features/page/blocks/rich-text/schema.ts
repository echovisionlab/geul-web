import { z } from 'zod';

/**
 * Rich Text block props schema.
 * Rich text blocks have no props - they only use materialized content.
 */
export const richTextSchema = z.object({});

export type RichTextProps = z.infer<typeof richTextSchema>;

/**
 * Parse and validate rich text props with defaults applied.
 */
export function parseRichTextProps(data: unknown): RichTextProps {
  return richTextSchema.parse(data ?? {});
}
