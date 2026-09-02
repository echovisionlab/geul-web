import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PostAction } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import { getTranslations } from 'next-intl/server';
import { PostEditor } from '@/features/post/PostEditor/PostEditor';
import { listCategoriesAction } from '@/lib/actions/category';
import { listPostShareLinksAction } from '@/lib/actions/post';
import { listTagsAction } from '@/lib/actions/tag';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { getManageSiteContext, getSettings } from '@/lib/queries/manifest';
import { getPostForEdit } from '@/lib/queries/post';
import { listMySeries, listSeriesSimple } from '@/lib/queries/series';
import type { ShareLink } from '@/lib/types/share-link/model';
import { buildEntityEditHref } from '@/lib/utils/entity-edit-route';
import { buildStaticOgMetadata } from '@/lib/utils/og';
import { toDate } from '@/lib/utils/proto';
import type { SearchParamRecord } from '@/lib/utils/request-path';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { getSession } from '@/lib/utils/session.server';
import { getBaseUrl } from '@/lib/utils/url.server';

export async function generatePostEditMetadata(idOrSlug: string): Promise<Metadata> {
  const t = await getTranslations('editorMetadata.postEdit');
  const [settings, baseUrl] = await Promise.all([getSettings(), getBaseUrl()]);
  const siteName = settings.site_title || 'Site';

  return withNoIndex(
    buildStaticOgMetadata({
      baseUrl,
      title: t('title'),
      description: t('description', { siteName }),
      path: `/posts/${encodeURIComponent(idOrSlug)}?edit=true`,
      siteName,
    }),
  );
}

export async function renderPostEditRoute(idOrSlug: string, query: SearchParamRecord) {
  const requestedPath = buildEntityEditHref(`/posts/${encodeURIComponent(idOrSlug)}`, query);
  const session = await getSession();
  if (!session?.user) {
    redirect(buildLoginRedirectHref(requestedPath));
  }

  const post = await getPostForEdit(idOrSlug);
  const canReadArchived = post?.status === 'archived' && session.user.role === 'author';
  if (!post || (!canReadArchived && !post.allowedActions.includes(PostAction.EDIT))) {
    notFound();
  }

  if (idOrSlug !== post.id) {
    redirect(buildEntityEditHref(`/posts/${encodeURIComponent(post.id)}`, query));
  }

  const isAdmin = session.user.role === 'admin';
  const [allCategories, allTags, seriesList, shareLinkData, baseUrl, site] = await Promise.all([
    listCategoriesAction(),
    listTagsAction(),
    isAdmin ? listSeriesSimple() : listMySeries(),
    post.allowedActions.includes(PostAction.MANAGE_SHARE_LINKS)
      ? listPostShareLinksAction(post.id)
      : Promise.resolve([]),
    getBaseUrl(),
    getManageSiteContext(),
  ]);

  const shareLinks: ShareLink<'post'>[] = shareLinkData.map((link) => ({
    id: link.id,
    entityType: 'post' as const,
    entityId: link.entityId,
    label: link.label ?? null,
    hasPassword: link.hasPassword,
    expiresAt: toDate(link.expiresAt) ?? new Date(0),
    createdAt: toDate(link.createdAt) ?? null,
    token: link.token,
    url: link.url,
  }));

  const series = seriesList.map((item: { id: string; title: string; slug?: string | null }) => ({
    id: item.id,
    title: item.title,
    slug: item.slug ?? '',
  }));
  const categories = post.categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug ?? '',
  }));
  const tags = post.tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug ?? '',
  }));

  return (
    <PostEditor
      postId={post.id}
      currentMemberId={session.user.id}
      initialTitle={post.title}
      initialSummary={post.summary ?? null}
      initialSlug={post.slug ?? null}
      initialStatus={post.status}
      initialScheduledAt={post.scheduledAt}
      initialScheduledTimeZone={post.scheduledTimeZone}
      initialAllowedActions={post.allowedActions}
      initialCategories={categories}
      initialTags={tags}
      initialFeaturedImageUrl={post.featuredImageUrl ?? null}
      initialCommentsEnabled={post.commentsEnabled}
      initialDocumentLayout={post.documentLayout}
      initialSeriesId={post.seriesId ?? null}
      initialSeriesOrder={post.seriesOrder ?? null}
      initialMapPlaceId={post.mapPlaceId ?? null}
      initialOgImageUrl={post.ogImageUrl ?? null}
      userName={session.user.nickname}
      isAdmin={isAdmin}
      baseUrl={baseUrl}
      canonicalOrigin={site.canonicalOrigin}
      siteName={site.siteName}
      categories={allCategories}
      tags={allTags}
      series={series}
      shareLinks={shareLinks}
    />
  );
}
