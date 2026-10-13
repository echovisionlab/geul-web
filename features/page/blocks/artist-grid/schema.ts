import * as z from '@/lib/zod-mini';
import {
  collectionSizeSchema,
  booleanString,
  imageAspectRatioSchema,
  listLayoutSchema,
  sortOrderSchema,
} from '../list-shared';

/**
 * Artist List block props schema.
 */
export const artistListSchema = z.object({
  layout: z._default(listLayoutSchema, 'grid'),
  itemSize: collectionSizeSchema,
  columns: z._default(z.string(), '3'),
  labelIds: z._default(z.string(), ''),
  sortBy: z._default(z.enum(['name', 'published_at']), 'name'),
  sortOrder: z._default(sortOrderSchema, 'asc'),
  limit: z._default(z.string(), '12'),
  showPagination: z._default(booleanString, 'false'),
  showImage: z._default(booleanString, 'true'),
  showMeta: z._default(booleanString, 'true'),
  imageAspectRatio: z._default(imageAspectRatioSchema, '1:1'),
  carouselLoop: z._default(booleanString, 'true'),
  carouselIndicators: z._default(booleanString, 'true'),
});

export type ArtistListProps = z.infer<typeof artistListSchema>;

/**
 * Parse and validate artist list props with defaults applied.
 */
export function parseArtistListProps(data: unknown): ArtistListProps {
  return artistListSchema.parse(data ?? {});
}
