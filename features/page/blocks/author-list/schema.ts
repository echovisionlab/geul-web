import { z } from 'zod';

const booleanString = z.enum(['true', 'false']);

/**
 * Author List block props schema.
 */
export const authorListSchema = z.object({
  source: z.enum(['automatic', 'selected']).default('automatic'),
  authorIds: z.string().default(''),
  layout: z.enum(['grid', 'list']).default('grid'),
  columns: z.string().default('3'),
  limit: z.string().default('6'),
  showBio: booleanString.default('true'),
  showAvatar: booleanString.default('true'),
});

export type AuthorListProps = z.infer<typeof authorListSchema>;

/**
 * Parse and validate author list props with defaults applied.
 */
export function parseAuthorListProps(data: unknown): AuthorListProps {
  return authorListSchema.parse(data ?? {});
}

export function parseAuthorIds(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ].slice(0, 24);
}
