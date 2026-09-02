import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { PostTaxonomyListPage } from '@/features/post/PostTaxonomyListPage';
import { getTagMetadataDocument } from '@/lib/queries/metadata';
import { getPublicTagBySlug } from '@/lib/queries/taxonomy';
import { buildTaxonomyJsonLd } from '@/lib/utils/json-ld';
import { buildPageOgMetadata } from '@/lib/utils/og';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const [tag, tCommonEntities] = await Promise.all([
    getTagMetadataDocument(decodedSlug),
    getTranslations('common.entities'),
  ]);

  if (!tag) {
    return {};
  }

  return buildPageOgMetadata({
    canonicalOrigin: tag.site.canonicalOrigin,
    routePath: tag.routePath,
    title: `${tag.name} · ${tCommonEntities('posts')}`,
    summary: tag.name,
    siteOgImageUrl: tag.site.siteOgImageUrl,
    siteName: tag.site.siteTitle || undefined,
  });
}

export default async function TagPostsPage({ params }: Props) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  const [tag, tagMetadata] = await Promise.all([getPublicTagBySlug(decodedSlug), getTagMetadataDocument(decodedSlug)]);

  if (!tag) {
    notFound();
  }

  return (
    <>
      {tagMetadata && <JsonLdScript data={buildTaxonomyJsonLd(tagMetadata)} />}
      <PostTaxonomyListPage kind="tag" taxonomyId={tag.id} name={tag.name} />
    </>
  );
}
