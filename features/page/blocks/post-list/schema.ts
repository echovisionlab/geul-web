import { z } from 'zod';

/**
 * Boolean stored as string for Yjs serialization compatibility.
 */
const booleanString = z.enum(['true', 'false']);

/**
 * Post List block props schema.
 */
export const postListSchema = z.object({
  // Layout
  layout: z.enum(['grid', 'list', 'cards', 'minimal', 'carousel']).default('grid'),
  columns: z.string().default('3'),

  // Filters
  categoryIds: z.string().default(''),
  tagIds: z.string().default(''),
  authorIds: z.string().default(''),
  seriesId: z.string().default(''), // single series filter

  // Sorting & Pagination
  sortBy: z.enum(['published_at', 'updated_at', 'title']).default('published_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.string().default('6'),
  showPagination: booleanString.default('false'),

  // Display Options
  showFeaturedImage: booleanString.default('true'),
  showMeta: booleanString.default('true'),
  imageAspectRatio: z.enum(['16:9', '4:3', '1:1', 'auto']).default('16:9'),

  // Carousel Options
  carouselLoop: booleanString.default('true'),
  carouselIndicators: booleanString.default('true'),
});

export type PostListProps = z.infer<typeof postListSchema>;

/**
 * Parse and validate post list props with defaults applied.
 */
export function parsePostListProps(data: unknown): PostListProps {
  return postListSchema.parse(data ?? {});
}
