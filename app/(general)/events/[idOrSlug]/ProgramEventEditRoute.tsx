import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ProgramEventEditor } from '@/features/program-event/ProgramEventEditor/ProgramEventEditor';
import { resolveProgramEventEditorActions } from '@/features/program-event/ProgramEventEditor/program-event-actions';
import { listArtistsAction } from '@/lib/actions/artist';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { listClientsAdmin } from '@/lib/queries/client';
import { listLabelsAdmin } from '@/lib/queries/label';
import { getManageSiteContext } from '@/lib/queries/manifest';
import {
  getProgramEventAdmin,
  listProgramEventSeriesAdmin,
  listProgramEventTypesAdmin,
} from '@/lib/queries/program-event';
import { buildEntityEditHref } from '@/lib/utils/entity-edit-route';
import type { SearchParamRecord } from '@/lib/utils/request-path';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { getSession } from '@/lib/utils/session.server';
import { getBaseUrl } from '@/lib/utils/url.server';

export async function generateProgramEventEditMetadata(): Promise<Metadata> {
  const [tActions, tEntities] = await Promise.all([
    getTranslations('common.actions'),
    getTranslations('common.entities'),
  ]);
  return withNoIndex({
    title: `${tActions('edit')} ${tEntities('programEvent')}`,
  });
}

export async function renderProgramEventEditRoute(idOrSlug: string, query: SearchParamRecord) {
  const requestedPath = buildEntityEditHref(`/events/${encodeURIComponent(idOrSlug)}`, query);
  const session = await getSession();
  if (!session?.user) {
    redirect(buildLoginRedirectHref(requestedPath));
  }
  const event = await getProgramEventAdmin(idOrSlug);
  const canEdit = session.user.role === 'admin';
  const canReadArchived = event?.status === 'archived' && session.user.role === 'author';
  if (!event || (!canEdit && !canReadArchived)) {
    notFound();
  }
  if (idOrSlug !== event.id) {
    redirect(buildEntityEditHref(`/events/${encodeURIComponent(event.id)}`, query));
  }

  const [baseUrl, site] = await Promise.all([getBaseUrl(), getManageSiteContext()]);
  const [types, series, artists, labels, clients] = canEdit
    ? await Promise.all([
        listProgramEventTypesAdmin(),
        listProgramEventSeriesAdmin(),
        listArtistsAction(),
        listLabelsAdmin({ pageSize: 100 }),
        listClientsAdmin({ pageSize: 100 }),
      ])
    : [[], [], [], { data: [] }, { data: [] }];

  return (
    <ProgramEventEditor
      eventId={event.id}
      currentMemberId={session.user.id}
      userName={session.user.nickname}
      initialTitle={event.title}
      initialSlug={event.slug}
      initialSummary={event.summary}
      initialStatus={event.status}
      initialSourceLocale={event.sourceLocale}
      initialTypeId={event.typeId}
      initialSeriesId={event.seriesId}
      initialSeriesOrder={event.seriesOrder}
      initialStartsAt={event.startsAt}
      initialEndsAt={event.endsAt}
      initialTimezone={event.timezone}
      initialAllDay={event.allDay}
      initialLocationMode={event.locationMode}
      initialMapPlaceId={event.mapPlaceId}
      initialPosterUrl={event.posterUrl}
      initialPosterMedia={event.media}
      initialTicketUrl={event.ticketUrl}
      initialStreamUrl={event.streamUrl}
      initialExternalUrl={event.externalUrl}
      initialArtists={event.artists.map((artist) => artist.artistId)}
      initialLabels={event.labels.map((label) => label.labelId)}
      initialClients={event.clients.map((client) => client.clientId)}
      initialCredits={event.credits}
      allowedActions={resolveProgramEventEditorActions(canEdit, event.status)}
      typeOptions={types.map((type) => ({ id: type.id, name: type.name }))}
      seriesOptions={series.map((item) => ({ id: item.id, title: item.title }))}
      canManageTaxonomy={canEdit}
      artistOptions={artists.map((artist) => ({ id: artist.id, name: artist.name }))}
      labelOptions={labels.data.map((label) => ({ id: label.id, name: label.name }))}
      clientOptions={clients.data.map((client) => ({ id: client.id, name: client.name }))}
      baseUrl={baseUrl}
      canonicalOrigin={site.canonicalOrigin}
      siteName={site.siteName}
    />
  );
}
