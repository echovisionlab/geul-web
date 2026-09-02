import { z } from 'zod';
import { booleanString, imageAspectRatioSchema, listLayoutSchema, sortOrderSchema } from '../list-shared';

/**
 * Artist List block props schema.
 */
export const artistListSchema = z.object({
  layout: listLayoutSchema.default('grid'),
  columns: z.string().default('3'),
  labelIds: z.string().default(''),
  sortBy: z.enum(['name', 'published_at']).default('name'),
  sortOrder: sortOrderSchema.default('asc'),
  limit: z.string().default('12'),
  showPagination: booleanString.default('false'),
  showImage: booleanString.default('true'),
  showMeta: booleanString.default('true'),
  imageAspectRatio: imageAspectRatioSchema.default('1:1'),
  carouselLoop: booleanString.default('true'),
  carouselIndicators: booleanString.default('true'),
});

export type ArtistListProps = z.infer<typeof artistListSchema>;

/**
 * Parse and validate artist list props with defaults applied.
 */
export function parseArtistListProps(data: unknown): ArtistListProps {
  return artistListSchema.parse(data ?? {});
}
