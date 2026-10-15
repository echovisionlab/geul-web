import * as z from '@/lib/zod-mini';
import { collectionSizeSchema } from '../list-shared';

const booleanString = z.enum(['true', 'false']);

/**
 * Author List block props schema.
 */
export const authorListSchema = z.object({
  source: z._default(z.enum(['automatic', 'selected']), 'automatic'),
  authorIds: z._default(z.string(), ''),
  layout: z._default(z.enum(['grid', 'list']), 'grid'),
  itemSize: collectionSizeSchema,
  columns: z._default(z.string(), '3'),
  limit: z._default(z.string(), '6'),
  showBio: z._default(booleanString, 'true'),
  showAvatar: z._default(booleanString, 'true'),
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
