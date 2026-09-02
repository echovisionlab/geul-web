import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ProgramEventSeriesEditor } from '@/features/program-event/ProgramEventSeriesEditor/ProgramEventSeriesEditor';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { getManageSiteContext } from '@/lib/queries/manifest';
import { getProgramEventSeriesAdmin } from '@/lib/queries/program-event';
import { buildEntityEditHref } from '@/lib/utils/entity-edit-route';
import type { SearchParamRecord } from '@/lib/utils/request-path';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { getSession } from '@/lib/utils/session.server';
import { getBaseUrl } from '@/lib/utils/url.server';

export async function generateProgramEventSeriesEditMetadata(): Promise<Metadata> {
  const [tActions, tEntities] = await Promise.all([
    getTranslations('common.actions'),
    getTranslations('common.entities'),
  ]);
  return withNoIndex({
    title: `${tActions('edit')} ${tEntities('programEventSeries')}`,
  });
}

export async function renderProgramEventSeriesEditRoute(idOrSlug: string, query: SearchParamRecord) {
  const requestedPath = buildEntityEditHref(`/event-series/${encodeURIComponent(idOrSlug)}`, query);
  const session = await getSession();
  if (!session?.user) {
    redirect(buildLoginRedirectHref(requestedPath));
  }
  if (session.user.role !== 'admin') {
    notFound();
  }

  const series = await getProgramEventSeriesAdmin(idOrSlug).catch(() => null);
  if (!series) {
    notFound();
  }
  if (idOrSlug !== series.id) {
    redirect(buildEntityEditHref(`/event-series/${encodeURIComponent(series.id)}`, query));
  }

  const [baseUrl, site] = await Promise.all([getBaseUrl(), getManageSiteContext()]);
  return (
    <ProgramEventSeriesEditor
      seriesId={series.id}
      initialTitle={series.title}
      initialSlug={series.slug}
      initialSummary={series.summary}
      initialDescription={series.description}
      initialStatus={series.status}
      initialPosterUrl={series.posterUrl}
      canonicalOrigin={site.canonicalOrigin}
      siteName={site.siteName}
      baseUrl={baseUrl}
    />
  );
}
