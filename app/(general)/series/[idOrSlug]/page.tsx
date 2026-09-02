import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import { ServerDataTablePagination } from '@/features/data-table/ServerDataTable/ServerDataTablePagination';
import { LocalizationNotice } from '@/features/translation/LocalizationNotice';
import { SeriesPublicPostsView, SeriesPublicView } from '@/features/series/SeriesPublicView';
import { ShareButton } from '@/features/share/ShareButton';
import { getSiteMetadataDocument } from '@/lib/queries/metadata';
import { listPublishedPosts } from '@/lib/queries/post';
import { getPublicSeries } from '@/lib/queries/series';
import { resolveContentRequestedLocale } from '@/lib/translation/content-language';
import {
  applyContentMetadataSeo,
  buildContentMetadataSeo,
  resolveLocalizedOgFallbacks,
} from '@/lib/translation/metadata';
import { getUserLocale } from '@/lib/utils/language.server';
import { buildSeriesOgMetadata } from '@/lib/utils/og';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { getBaseUrl } from '@/lib/utils/url.server';
import { parseBlockTableQuery, queryRecordToSearchParams } from '@/features/page/blocks/table-utils';
import { generatePageRouteFallbackMetadata, renderPageRouteFallback } from '@/app/_shared/page-route-fallback';

interface Props {
  params: Promise<{ idOrSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ idOrSlug }, query, uiLocale] = await Promise.all([params, searchParams, getUserLocale()]);
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  const [series, site] = await Promise.all([getPublicSeries(idOrSlug, { requestedLocale }), getSiteMetadataDocument()]);
  if (!series) {
    return generatePageRouteFallbackMetadata(['series', idOrSlug], query);
  }

  const routePath = `/series/${series.slug || series.id}`;
  const ogFallbacks = resolveLocalizedOgFallbacks(series.localizationInfo, {
    featuredImageUrl: series.featuredImageUrl,
    siteOgImageUrl: site.siteOgImageUrl,
  });
  const metadata = buildSeriesOgMetadata({
    canonicalOrigin: site.canonicalOrigin,
    routePath,
    title: series.title,
    description: series.description,
    ogImageUrl: series.ogImageUrl,
    ...ogFallbacks,
    siteName: site.siteTitle || undefined,
  });
  const seo = buildContentMetadataSeo({
    canonicalOrigin: site.canonicalOrigin,
    routePath,
    query,
    localizationInfo: series.localizationInfo,
  });
  const localizedMetadata = applyContentMetadataSeo(metadata, seo);
  return seo.noIndex ? withNoIndex(localizedMetadata) : localizedMetadata;
}

export default async function SeriesPage({ params, searchParams }: Props) {
  const [{ idOrSlug }, query, uiLocale] = await Promise.all([params, searchParams, getUserLocale()]);
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  const series = await getPublicSeries(idOrSlug, { requestedLocale });
  if (!series) {
    return renderPageRouteFallback(['series', idOrSlug], query);
  }

  const seriesPostsSearchParams = queryRecordToSearchParams(query);
  const postsQuery = parseBlockTableQuery(seriesPostsSearchParams, 'seriesPosts', 10);
  const postsPage = Math.max(1, postsQuery.page ?? 1);
  const postsPageSize = Math.max(1, Math.min(100, postsQuery.pageSize ?? 10));
  const [postResult, baseUrl, tCommon] = await Promise.all([
    listPublishedPosts({
      seriesId: series.id,
      sortBy: 'series_order',
      sortOrder: 'asc',
      limit: postsPageSize,
      offset: (postsPage - 1) * postsPageSize,
      requestedLocale,
    }),
    getBaseUrl(),
    getTranslations('common'),
  ]);
  const pathname = `/series/${series.slug || series.id}`;

  return (
    <>
      <LocalizationNotice
        pathname={pathname}
        query={query}
        requestedLocale={requestedLocale}
        localizationInfo={series.localizationInfo}
        variant="subtle"
      />
      <SeriesPublicView
        title={series.title}
        description={series.description}
        featuredImageUrl={series.featuredImageUrl}
        postsLabel={tCommon('entities.posts')}
        controls={
          <>
            <ContentLanguageMenu
              pathname={pathname}
              query={query}
              requestedLocale={requestedLocale}
              localizationInfo={series.localizationInfo}
            />
            <ShareButton url={`${baseUrl}${pathname}`} title={series.title} />
          </>
        }
      >
        <SeriesPublicPostsView
          posts={postResult.posts.map((post) => ({
            id: post.id,
            title: post.title,
            slug: post.slug,
            publishedAt: post.published_at?.toISOString() ?? null,
            authors: post.authors.map((author: { id: string; name?: string | null }) => ({
              id: author.id,
              name: author.name,
            })),
          }))}
          labels={{
            title: tCommon('labels.title'),
            authors: tCommon('labels.authors'),
            published: tCommon('labels.published'),
            empty: tCommon('messages.noPostsFound'),
            untitled: tCommon('states.untitled'),
            unknown: tCommon('states.unknown'),
          }}
        />
        <ServerDataTablePagination
          namespace="seriesPosts"
          result={{
            data: postResult.posts,
            total: postResult.pagination.total,
            page: postsPage,
            pageSize: postsPageSize,
            totalPages: Math.ceil(postResult.pagination.total / postsPageSize),
          }}
          searchParams={seriesPostsSearchParams}
          reserveSpaceWhenHidden
        />
      </SeriesPublicView>
    </>
  );
}
