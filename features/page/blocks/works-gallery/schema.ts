import * as z from '@/lib/zod-mini';
import {
  collectionSizeSchema,
  booleanString,
  imageAspectRatioSchema,
  listLayoutSchema,
  sortOrderSchema,
} from '../list-shared';

/**
 * Work List block props schema.
 */
export const workListSchema = z.object({
  layout: z._default(listLayoutSchema, 'grid'),
  itemSize: collectionSizeSchema,
  columns: z._default(z.string(), '3'),
  workTypes: z._default(z.string(), ''),
  featuredOnly: z._default(booleanString, 'false'),
  sortBy: z._default(z.enum(['published_at', 'updated_at', 'title']), 'published_at'),
  sortOrder: z._default(sortOrderSchema, 'desc'),
  limit: z._default(z.string(), '6'),
  showPagination: z._default(booleanString, 'false'),
  showImage: z._default(booleanString, 'true'),
  showMeta: z._default(booleanString, 'true'),
  imageAspectRatio: z._default(imageAspectRatioSchema, '16:9'),
  carouselLoop: z._default(booleanString, 'true'),
  carouselIndicators: z._default(booleanString, 'true'),
});

export type WorkListProps = z.infer<typeof workListSchema>;

/**
 * Parse and validate work list props with defaults applied.
 */
export function parseWorkListProps(data: unknown): WorkListProps {
  return workListSchema.parse(data ?? {});
}
