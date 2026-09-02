// Server Component - no 'use client'
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { notFound, redirect } from 'next/navigation';
import { TranslationEntityType } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { getTranslations } from 'next-intl/server';
import { PageEditor } from '@/features/page/PageEditor/PageEditor';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { createTranslationClient } from '@/lib/api/server-client';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { getManageSiteContext } from '@/lib/queries/manifest';
import { getPageMetadataDocument, getSiteMetadataDocument } from '@/lib/queries/metadata';
import { getPage } from '@/lib/queries/page';
import { readContentLocaleOverride, resolveContentRequestedLocale } from '@/lib/translation/content-language';
import {
  applyContentMetadataSeo,
  buildContentMetadataSeo,
  resolveLocalizedOgFallbacks,
} from '@/lib/translation/metadata';
import { buildPageJsonLd } from '@/lib/utils/json-ld';
import { getUserLocale } from '@/lib/utils/language.server';
import { buildPageOgMetadata } from '@/lib/utils/og';
import { buildPagePath } from '@/lib/utils/page-route';
import { buildSearchSuffix } from '@/lib/utils/request-path';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { getSession } from '@/lib/utils/session.server';
import { joinUrl } from '@/lib/utils/url';
import { getBaseUrl } from '@/lib/utils/url.server';
import { PageContent } from './PageContent';
import { PageContentWithToken } from './PageContentWithToken';

import './page-view.css';

interface Props {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function joinPageSlug(segments: string[]): string {
  return segments.join('/');
}

function isEditRequest(query: Record<string, string | string[] | undefined>): boolean {
  const edit = query.edit;
  return (Array.isArray(edit) ? edit[0] : edit) === 'true';
}

async function getInitialPageTranslationState(pageId: string, requestedLocale: string | null) {
  try {
    const response = await (
      await createTranslationClient()
    ).listEntityTranslations({
      target: { entityType: TranslationEntityType.PAGE, entityId: pageId },
    });
    const requestedEntry =
      requestedLocale && requestedLocale !== response.sourceLocale
        ? response.entries.find((entry) => entry.locale === requestedLocale)
        : undefined;
    return {
      sourceLocale: response.sourceLocale,
      requestedLocale,
      requestedLocaleHasEntry: Boolean(requestedEntry),
      requestedLocaleTitle: requestedEntry?.title ?? null,
      requestedLocaleSummary: requestedEntry?.summary ?? null,
    };
  } catch {
    return {
      sourceLocale: null,
      requestedLocale,
      requestedLocaleHasEntry: false,
      requestedLocaleTitle: null,
      requestedLocaleSummary: null,
    };
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug: slugSegments }, query] = await Promise.all([params, searchParams]);
  const slug = joinPageSlug(slugSegments);
  if (isEditRequest(query)) {
    await connection();
    const tEdit = await getTranslations('editorMetadata.pageEdit');
    return withNoIndex({ title: tEdit('title') });
  }

  const t = await getTranslations('contentMetadata.preview');
  const shareToken = query.share;
  const shareTokenValue = Array.isArray(shareToken) ? shareToken[0] : shareToken;
  if (shareTokenValue) {
    await connection();
  }
  const uiLocale = await getUserLocale();
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);
  const page = await getPageMetadataDocument(slug, { requestedLocale });

  if (!page) {
    if (shareTokenValue) {
      const site = await getSiteMetadataDocument();
      return withNoIndex({
        title: t('page'),
        alternates: {
          canonical: joinUrl(site.canonicalOrigin, `/${slug}`),
        },
      });
    }
    return {};
  }

  const ogFallbacks = resolveLocalizedOgFallbacks(page.localizationInfo, {
    featuredImageUrl: page.featuredImageUrl,
    siteOgImageUrl: page.site.siteOgImageUrl,
  });
  const metadata = buildPageOgMetadata({
    canonicalOrigin: page.site.canonicalOrigin,
    routePath: page.routePath,
    title: page.title,
    summary: page.summary,
    ogImageUrl: page.ogImageUrl,
    ...ogFallbacks,
    siteName: page.site.siteTitle || undefined,
  });
  const seo = buildContentMetadataSeo({
    canonicalOrigin: page.site.canonicalOrigin,
    routePath: page.routePath,
    query,
    localizationInfo: page.localizationInfo,
  });
  const localizedMetadata = applyContentMetadataSeo(metadata, seo);

  if (!shareTokenValue) {
    return seo.noIndex ? withNoIndex(localizedMetadata) : localizedMetadata;
  }

  return withNoIndex({
    ...localizedMetadata,
    alternates: {
      canonical: joinUrl(page.site.canonicalOrigin, page.routePath),
    },
  });
}

export default async function PublicPageView({ params, searchParams }: Props) {
  const [{ slug: slugSegments }, query] = await Promise.all([params, searchParams]);
  const slug = joinPageSlug(slugSegments);
  if (isEditRequest(query)) {
    await connection();
    const session = await getSession();
    if (!session?.user) {
      redirect(buildLoginRedirectHref(`${buildPagePath(slug)}${buildSearchSuffix(query)}`));
    }
    if (session.user.role !== 'admin') {
      notFound();
    }

    const page = await getPage(slug);
    if (!page) {
      notFound();
    }

    if (slug !== page.id) {
      redirect(`${buildPagePath(page.id)}${buildSearchSuffix(query)}`);
    }

    const requestedLocale = readContentLocaleOverride(query);
    const [baseUrl, site, initialTranslationState] = await Promise.all([
      getBaseUrl(),
      getManageSiteContext(),
      getInitialPageTranslationState(page.id, requestedLocale),
    ]);

    return (
      <PageEditor
        pageId={page.id}
        currentMemberId={session.user.id}
        canManageTranslations={session.user.role === 'admin'}
        initialTitle={page.title}
        initialSummary={page.summary}
        initialSourceLocale={initialTranslationState.sourceLocale}
        initialRequestedLocale={initialTranslationState.requestedLocale}
        initialRequestedLocaleHasEntry={initialTranslationState.requestedLocaleHasEntry}
        initialRequestedLocaleTitle={initialTranslationState.requestedLocaleTitle}
        initialRequestedLocaleSummary={initialTranslationState.requestedLocaleSummary}
        initialSlug={page.slug ?? null}
        initialStatus={page.status}
        initialShowTitle={page.showTitle}
        initialDocumentLayout={page.documentLayout}
        initialFeaturedImageUrl={page.featuredImageUrl ?? null}
        initialOgImageUrl={page.ogImageUrl ?? null}
        userName={session.user.nickname}
        baseUrl={baseUrl}
        canonicalOrigin={site.canonicalOrigin}
        siteName={site.siteName}
      />
    );
  }

  const uiLocale = await getUserLocale();
  const requestedLocale = resolveContentRequestedLocale(uiLocale, query);

  const shareToken = query.share;
  const shareTokenValue = Array.isArray(shareToken) ? shareToken[0] : shareToken;
  if (shareTokenValue) {
    await connection();
  }

  // Share link mode: bypass access checks with token verification
  if (shareTokenValue) {
    return <PageContentWithToken slug={slug} token={shareTokenValue} query={query} requestedLocale={requestedLocale} />;
  }

  const pageMetadata = await getPageMetadataDocument(slug, { requestedLocale });

  return (
    <>
      {pageMetadata && <JsonLdScript data={buildPageJsonLd(pageMetadata)} />}
      <PageContent slug={slug} query={query} requestedLocale={requestedLocale} />
    </>
  );
}
