import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { WorkEditor } from '@/features/work/WorkEditor/WorkEditor';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import type { WorkType } from '@/lib/contexts/WorkMetaContext';
import { getManageSiteContext, getSettings } from '@/lib/queries/manifest';
import { getWorkForEdit } from '@/lib/queries/work';
import { buildEntityEditHref } from '@/lib/utils/entity-edit-route';
import { buildStaticOgMetadata } from '@/lib/utils/og';
import type { SearchParamRecord } from '@/lib/utils/request-path';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { getSession } from '@/lib/utils/session.server';
import { getBaseUrl } from '@/lib/utils/url.server';

export async function generateWorkEditMetadata(idOrSlug: string): Promise<Metadata> {
  const t = await getTranslations('editorMetadata.workEdit');
  const [settings, baseUrl] = await Promise.all([getSettings(), getBaseUrl()]);
  const siteName = settings.site_title || 'Site';

  return withNoIndex(
    buildStaticOgMetadata({
      baseUrl,
      title: t('title'),
      description: t('description', { siteName }),
      path: `/works/${encodeURIComponent(idOrSlug)}?edit=true`,
      siteName,
    }),
  );
}

export async function renderWorkEditRoute(idOrSlug: string, query: SearchParamRecord) {
  const requestedPath = buildEntityEditHref(`/works/${encodeURIComponent(idOrSlug)}`, query);
  const session = await getSession();
  if (!session?.user) {
    redirect(buildLoginRedirectHref(requestedPath));
  }
  const work = await getWorkForEdit(idOrSlug);
  const isAdmin = session.user.role === 'admin';
  const canReadArchived = work?.status === 'archived' && session.user.role === 'author';
  if (!work || (!isAdmin && !canReadArchived)) {
    notFound();
  }

  if (idOrSlug !== work.id) {
    redirect(buildEntityEditHref(`/works/${encodeURIComponent(work.id)}`, query));
  }

  const [baseUrl, site] = await Promise.all([getBaseUrl(), getManageSiteContext()]);
  return (
    <WorkEditor
      workId={work.id}
      currentMemberId={session.user.id}
      initialTitle={work.title}
      initialSlug={work.slug}
      initialType={work.type as WorkType}
      initialYear={work.year}
      initialMonth={work.month}
      initialUntilYear={work.untilYear}
      initialUntilMonth={work.untilMonth}
      initialIsPresent={work.isPresent}
      initialSummary={work.summary}
      initialMetadata={(work.metadata as Record<string, unknown>) ?? {}}
      initialFeatured={work.featured ?? false}
      initialStatus={work.status}
      initialMapPlaceId={work.mapPlaceId ?? null}
      initialFeaturedImageUrl={work.featuredImageUrl ?? null}
      initialOgImageUrl={work.ogImageUrl ?? null}
      initialClients={work.clientIds ?? []}
      initialClientDetails={work.clientDetails ?? []}
      userName={session.user.nickname}
      isAdmin={isAdmin}
      canEdit={isAdmin}
      baseUrl={baseUrl}
      canonicalOrigin={site.canonicalOrigin}
      siteName={site.siteName}
    />
  );
}
