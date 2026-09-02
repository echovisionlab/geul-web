// Server Component - no 'use client'
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { PageLoader } from '@/features/site/PageLoader';
import { getPostMetadataDocument } from '@/lib/queries/metadata';
import { getPostView, getPostViewWithToken } from '@/lib/queries/post';
import { resolveContentRequestedLocale } from '@/lib/translation/content-language';
import {
  applyContentMetadataSeo,
  buildContentMetadataSeo,
  resolveLocalizedOgFallbacks,
} from '@/lib/translation/metadata';
import { buildPostJsonLd } from '@/lib/utils/json-ld';
import { getUserLocale } from '@/lib/utils/language.server';
import { buildPostOgMetadata } from '@/lib/utils/og';
import { isEntityEditView } from '@/lib/utils/entity-edit-route';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { joinUrl } from '@/lib/utils/url';
import { generatePageRouteFallbackMetadata, renderPageRouteFallback } from '@/app/_shared/page-route-fallback';
import { PostContent } from './PostContent';
import { PostContentWithToken } from './PostContentWithToken';
import { generatePostEditMetadata, renderPostEditRoute } from './PostEditRoute';

interface Props {
  params: Promise<{ idOrSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ idOrSlug }, query] = await Promise.all([params, searchParams]);
  if (isEntityEditView(query)) {
    return generatePostEditMetadata(idOrSlug);
  }

  if (query.share) {
    await connection();
  }
  const uiLocale = await getUserLocale();
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  const post = await getPostMetadataDocument(idOrSlug, { requestedLocale });

  if (!post) {
    return generatePageRouteFallbackMetadata(['posts', idOrSlug], query);
  }

  const ogFallbacks = resolveLocalizedOgFallbacks(post.localizationInfo, {
    featuredImageUrl: post.featuredImageUrl,
    siteOgImageUrl: post.site.siteOgImageUrl,
  });
  const metadata = buildPostOgMetadata({
    canonicalOrigin: post.site.canonicalOrigin,
    routePath: post.routePath,
    title: post.title,
    summary: post.summary,
    ogImageUrl: post.ogImageUrl,
    ...ogFallbacks,
    publishedAt: post.publishedAt,
    authors: post.authors.map((a) => a.name),
    siteName: post.site.siteTitle || undefined,
  });
  const seo = buildContentMetadataSeo({
    canonicalOrigin: post.site.canonicalOrigin,
    routePath: post.routePath,
    query,
    localizationInfo: post.localizationInfo,
  });
  const localizedMetadata = applyContentMetadataSeo(metadata, seo);

  if (!query.share) {
    return seo.noIndex ? withNoIndex(localizedMetadata) : localizedMetadata;
  }

  return withNoIndex({
    ...localizedMetadata,
    alternates: {
      canonical: joinUrl(post.site.canonicalOrigin, post.routePath),
    },
  });
}

export default async function PostViewPage({ params, searchParams }: Props) {
  const [{ idOrSlug }, query] = await Promise.all([params, searchParams]);

  if (isEntityEditView(query)) {
    return renderPostEditRoute(idOrSlug, query);
  }

  const shareToken = Array.isArray(query.share) ? query.share[0] : query.share;
  if (shareToken) {
    await connection();
  }
  const uiLocale = await getUserLocale();
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);

  // Share link mode: bypass access checks with token verification
  if (shareToken) {
    const post = await getPostViewWithToken(idOrSlug, shareToken, requestedLocale);

    if (!post) {
      return renderPageRouteFallback(['posts', idOrSlug], query);
    }

    return (
      <Suspense fallback={<PageLoader />}>
        <PostContentWithToken
          idOrSlug={idOrSlug}
          token={shareToken}
          initialPost={post}
          requestedLocale={requestedLocale}
          query={query}
        />
      </Suspense>
    );
  }

  // Resolve visibility before entering Suspense so missing or unauthorized
  // posts produce an HTTP 404 before streaming commits a successful response.
  const [post, postMetadata] = await Promise.all([
    getPostView(idOrSlug, { requestedLocale }),
    getPostMetadataDocument(idOrSlug, { requestedLocale }),
  ]);

  if (!post) {
    return renderPageRouteFallback(['posts', idOrSlug], query);
  }

  return (
    <>
      {postMetadata && <JsonLdScript data={buildPostJsonLd(postMetadata)} />}
      <Suspense fallback={<PageLoader />}>
        <PostContent idOrSlug={idOrSlug} initialPost={post} requestedLocale={requestedLocale} query={query} />
      </Suspense>
    </>
  );
}
