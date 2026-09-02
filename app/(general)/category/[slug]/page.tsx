import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { PostTaxonomyListPage } from '@/features/post/PostTaxonomyListPage';
import { getCategoryMetadataDocument } from '@/lib/queries/metadata';
import { getPublicCategoryBySlug } from '@/lib/queries/taxonomy';
import { buildTaxonomyJsonLd } from '@/lib/utils/json-ld';
import { buildPageOgMetadata } from '@/lib/utils/og';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const [category, tCommonEntities] = await Promise.all([
    getCategoryMetadataDocument(decodedSlug),
    getTranslations('common.entities'),
  ]);

  if (!category) {
    return {};
  }

  return buildPageOgMetadata({
    canonicalOrigin: category.site.canonicalOrigin,
    routePath: category.routePath,
    title: `${category.name} · ${tCommonEntities('posts')}`,
    summary: category.description ?? category.name,
    siteOgImageUrl: category.site.siteOgImageUrl,
    siteName: category.site.siteTitle || undefined,
  });
}

export default async function CategoryPostsPage({ params }: Props) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  const [category, categoryMetadata] = await Promise.all([
    getPublicCategoryBySlug(decodedSlug),
    getCategoryMetadataDocument(decodedSlug),
  ]);

  if (!category) {
    notFound();
  }

  return (
    <>
      {categoryMetadata && <JsonLdScript data={buildTaxonomyJsonLd(categoryMetadata)} />}
      <PostTaxonomyListPage
        kind="category"
        taxonomyId={category.id}
        name={category.name}
        description={category.description}
      />
    </>
  );
}
