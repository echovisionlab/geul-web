import { z } from 'zod';
import { booleanString, imageAspectRatioSchema, listLayoutSchema, sortOrderSchema } from '../list-shared';

/**
 * Release List block props schema.
 */
export const releaseListSchema = z.object({
  layout: listLayoutSchema.default('grid'),
  columns: z.string().default('4'),
  types: z.string().default(''),
  categoryIds: z.string().default(''),
  artistId: z.string().default(''),
  labelId: z.string().default(''),
  sortBy: z.enum(['published_at', 'release_date', 'title']).default('release_date'),
  sortOrder: sortOrderSchema.default('desc'),
  limit: z.string().default('8'),
  showPagination: booleanString.default('false'),
  showImage: booleanString.default('true'),
  showMeta: booleanString.default('true'),
  imageAspectRatio: imageAspectRatioSchema.default('1:1'),
  carouselLoop: booleanString.default('true'),
  carouselIndicators: booleanString.default('true'),
});

export type ReleaseListProps = z.infer<typeof releaseListSchema>;

/**
 * Parse and validate release list props with defaults applied.
 */
export function parseReleaseListProps(data: unknown): ReleaseListProps {
  return releaseListSchema.parse(data ?? {});
}
