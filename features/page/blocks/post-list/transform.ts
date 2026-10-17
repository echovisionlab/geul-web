/** The fields of a published post that its list item needs (server and browser queries share them). */
export interface PostListSource {
  id: string;
  slug?: string | null;
  title: string;
  featured_image_url?: string | null;
  published_at?: Date | null;
  authors: readonly { id: string; name: string; avatar_url?: string | null }[];
  categories: readonly { id: string; name: string; slug?: string | null }[];
  tags: readonly { id: string; name: string; slug?: string | null }[];
}

/** Dates become ISO strings so the item crosses the server/client boundary. */
export function toPostListItem(post: PostListSource) {
  return {
    id: post.id,
    slug: post.slug ?? null,
    title: post.title,
    featured_image_url: post.featured_image_url ?? null,
    published_at: post.published_at?.toISOString() ?? null,
    authors: post.authors.map((author) => ({ id: author.id, name: author.name, image: author.avatar_url ?? null })),
    categories: post.categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug ?? null,
    })),
    tags: post.tags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug ?? null })),
  };
}

/** The query a post list block's props describe. */
export function postListQuery(p: {
  categoryIds?: string;
  tagIds?: string;
  authorIds?: string;
  seriesId?: string;
  sortBy?: string;
  sortOrder?: string;
  limit?: string;
}) {
  return {
    categoryIds: p.categoryIds ? p.categoryIds.split(',').filter(Boolean) : undefined,
    tagIds: p.tagIds ? p.tagIds.split(',').filter(Boolean) : undefined,
    authorIds: p.authorIds ? p.authorIds.split(',').filter(Boolean) : undefined,
    seriesId: p.seriesId || undefined,
    sortBy: (p.sortBy as 'published_at' | 'updated_at' | 'title') || 'published_at',
    sortOrder: (p.sortOrder as 'asc' | 'desc') || 'desc',
    limit: parseInt(p.limit || '6', 10),
  };
}
