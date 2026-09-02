import { z } from 'zod';
import { booleanString, imageAspectRatioSchema, listLayoutSchema, sortOrderSchema } from '../list-shared';

/**
 * Work List block props schema.
 */
export const workListSchema = z.object({
  layout: listLayoutSchema.default('grid'),
  columns: z.string().default('3'),
  workTypes: z.string().default(''),
  featuredOnly: booleanString.default('false'),
  sortBy: z.enum(['published_at', 'updated_at', 'title']).default('published_at'),
  sortOrder: sortOrderSchema.default('desc'),
  limit: z.string().default('6'),
  showPagination: booleanString.default('false'),
  showImage: booleanString.default('true'),
  showMeta: booleanString.default('true'),
  imageAspectRatio: imageAspectRatioSchema.default('16:9'),
  carouselLoop: booleanString.default('true'),
  carouselIndicators: booleanString.default('true'),
});

export type WorkListProps = z.infer<typeof workListSchema>;

/**
 * Parse and validate work list props with defaults applied.
 */
export function parseWorkListProps(data: unknown): WorkListProps {
  return workListSchema.parse(data ?? {});
}
