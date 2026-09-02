import type { getPostView } from '@/lib/queries/post';

type PostViewSource = NonNullable<Awaited<ReturnType<typeof getPostView>>>;

export function toPostViewModel(post: PostViewSource) {
  return {
    id: post.id,
    slug: post.slug ?? null,
    title: post.title,
    summary: post.summary ?? null,
    content: post.content,
    blockMedia: post.blockMedia,
    documentLayout: post.documentLayout,
    commentsEnabled: post.commentsEnabled,
    status: post.status,
    statusCode: post.statusCode,
    series: null,
    featuredImageUrl: post.featuredImageUrl ?? null,
    publishedAt: post.publishedAt ?? null,
    updatedAt: post.updatedAt ?? null,
    authors: post.authors.map((author) => ({
      id: author.id,
      name: author.name,
      image: author.avatarUrl ?? null,
    })),
    collaborators: [] as { id: string; name: string | null; image: string | null; role: string }[],
    categories: post.categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug ?? null,
    })),
    tags: post.tags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug ?? null })),
    locationPlace: post.locationPlace ?? null,
    canEdit: false,
    localizationInfo: post.localizationInfo ?? null,
  };
}
