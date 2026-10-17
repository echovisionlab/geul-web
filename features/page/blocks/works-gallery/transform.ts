/** The fields of a published work that its list item needs (server query and browser action share them). */
export interface WorkListSource<Type extends string = string> {
  id: string;
  slug?: string | null;
  title: string;
  featuredImageUrl?: string | null;
  type: Type;
  publishedAt?: Date | null;
}

export function toWorkListItem<Type extends string>(work: WorkListSource<Type>) {
  return {
    id: work.id,
    href: `/works/${work.slug || work.id}`,
    title: work.title,
    imageUrl: work.featuredImageUrl ?? null,
    imageAlt: work.title,
    type: work.type,
    publishedAt: work.publishedAt?.toISOString() ?? null,
  };
}
