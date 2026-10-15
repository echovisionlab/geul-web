import * as z from '@/lib/zod-mini';
import {
  collectionSizeSchema,
  booleanString,
  imageAspectRatioSchema,
  listLayoutSchema,
  sortOrderSchema,
} from '../list-shared';

/**
 * Release List block props schema.
 */
export const releaseListSchema = z.object({
  layout: z._default(listLayoutSchema, 'grid'),
  itemSize: collectionSizeSchema,
  columns: z._default(z.string(), '4'),
  types: z._default(z.string(), ''),
  categoryIds: z._default(z.string(), ''),
  artistId: z._default(z.string(), ''),
  labelId: z._default(z.string(), ''),
  sortBy: z._default(z.enum(['published_at', 'release_date', 'title']), 'release_date'),
  sortOrder: z._default(sortOrderSchema, 'desc'),
  limit: z._default(z.string(), '8'),
  showPagination: z._default(booleanString, 'false'),
  showImage: z._default(booleanString, 'true'),
  showMeta: z._default(booleanString, 'true'),
  imageAspectRatio: z._default(imageAspectRatioSchema, '1:1'),
  carouselLoop: z._default(booleanString, 'true'),
  carouselIndicators: z._default(booleanString, 'true'),
});

export type ReleaseListProps = z.infer<typeof releaseListSchema>;

/**
 * Parse and validate release list props with defaults applied.
 */
export function parseReleaseListProps(data: unknown): ReleaseListProps {
  return releaseListSchema.parse(data ?? {});
}
