import * as z from '@/lib/zod-mini';
import { collectionSizeSchema } from '../list-shared';

/**
 * Boolean stored as string for Yjs serialization compatibility.
 */
const booleanString = z.enum(['true', 'false']);

/**
 * Post List block props schema.
 */
export const postListSchema = z.object({
  // Layout
  layout: z._default(z.enum(['grid', 'list', 'cards', 'minimal', 'carousel']), 'grid'),
  itemSize: collectionSizeSchema,
  columns: z._default(z.string(), '3'),

  // Filters
  categoryIds: z._default(z.string(), ''),
  tagIds: z._default(z.string(), ''),
  authorIds: z._default(z.string(), ''),
  seriesId: z._default(z.string(), ''), // single series filter

  // Sorting & Pagination
  sortBy: z._default(z.enum(['published_at', 'updated_at', 'title']), 'published_at'),
  sortOrder: z._default(z.enum(['asc', 'desc']), 'desc'),
  limit: z._default(z.string(), '6'),
  showPagination: z._default(booleanString, 'false'),

  // Display Options
  showFeaturedImage: z._default(booleanString, 'true'),
  showMeta: z._default(booleanString, 'true'),
  imageAspectRatio: z._default(z.enum(['16:9', '4:3', '1:1', 'auto']), '16:9'),

  // Carousel Options
  carouselLoop: z._default(booleanString, 'true'),
  carouselIndicators: z._default(booleanString, 'true'),
});

export type PostListProps = z.infer<typeof postListSchema>;

/**
 * Parse and validate post list props with defaults applied.
 */
export function parsePostListProps(data: unknown): PostListProps {
  return postListSchema.parse(data ?? {});
}
