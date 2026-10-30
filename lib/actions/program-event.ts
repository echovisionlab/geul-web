'use server';

import { logServerFailure } from '@/lib/logging/logger';
import type { ActionResult } from '@/lib/actions/action-result';
import { runAction } from '@/lib/actions/run-action';
import { queryResult } from '@/lib/api/query-result';

import { isConnectError } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { create } from '@bufbuild/protobuf';
import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { FilterOp, FilterSpecSchema, SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import {
  ProgramEventArtistSchema,
  ProgramEventArtistsSnapshotSchema,
  ProgramEventClientSchema,
  ProgramEventClientsSnapshotSchema,
  ProgramEventCreditSchema,
  ProgramEventLabelSchema,
  ProgramEventLabelsSnapshotSchema,
  ProgramEventLocationMode,
  ProgramEventSeriesStatus,
  ProgramEventTypeStatus,
  type ProgramEventCredit,
} from '@echovisionlab/geul-proto/secure/program_event_pb.ts';
import {
  createArtistClient,
  createFileClient,
  createProgramEventClient,
  createProgramEventSeriesClient,
  createProgramEventTypeClient,
} from '@/lib/api/server-client';
import {
  fetchMediaDeliveryBatches,
  mergeRecordBatches,
  uniqueMediaIdsInOrder,
} from '@/lib/media/media-delivery-batches';
import { getUserLocale } from '@/lib/utils/language.server';
import { generateSlug, toSlugInputValue } from '@/lib/utils/slug';

// Program Event actions have always reported a refused permission as 'Unauthorized'.
const PROGRAM_EVENT_FAILURE_MESSAGES = { [Code.PermissionDenied]: 'Unauthorized' };

type ProgramEventLocationModeValue = 'map_place' | 'online' | 'hybrid' | 'tba';
type ProgramEventSeriesStatusValue = 'draft' | 'published';

export interface ProgramEventRelationInput {
  id: string;
  role?: string | null;
  sortOrder?: number;
}

export interface ProgramEventCreditInput {
  id?: string;
  artistId?: string | null;
  memberId?: string | null;
  displayName?: string | null;
  creditRole?: string | null;
  description?: string | null;
  sortOrder?: number;
}

export interface ProgramEventCreditItem {
  id: string;
  artistId: string | null;
  memberId: string | null;
  displayName: string | null;
  creditRole: string | null;
  description: string | null;
  sortOrder: number;
  artist: {
    id: string;
    name: string;
    slug: string | null;
    imageUrl: string | null;
  } | null;
  member: {
    id: string;
    name: string;
    image: string | null;
  } | null;
}

export interface ProgramEventPosterMediaItem {
  id: string;
  fileId: string;
  url: string | null;
  role: string;
  sortOrder: number;
  isPrimary: boolean;
  alt: string | null;
  caption: string | null;
}

async function hydrateProgramEventPosterMedia(
  media: Array<{
    id: string;
    fileId: string;
    role: string;
    sortOrder: number;
    isPrimary: boolean;
    alt?: string;
    caption?: string;
  }>,
): Promise<ProgramEventPosterMediaItem[]> {
  const posters = media.filter((item) => item.role === 'poster');
  const fileIds = uniqueMediaIdsInOrder(posters.map((item) => item.fileId));
  const urls: Record<string, string | null> = {};
  if (fileIds.length > 0) {
    const fileClient = await createFileClient();
    const responses = await fetchMediaDeliveryBatches(fileIds, (batch) =>
      fileClient.getBulkMediaDeliveries({ fileIds: batch }),
    );
    const files = mergeRecordBatches(responses.map((response) => response.files));
    for (const fileId of fileIds) {
      const delivery = files[fileId]?.delivery;
      urls[fileId] = delivery?.thumbnail?.url || delivery?.asset?.url || delivery?.inline?.url || null;
    }
  }
  return posters
    .map((item) => ({
      id: item.id,
      fileId: item.fileId,
      url: urls[item.fileId] ?? null,
      role: item.role,
      sortOrder: item.sortOrder,
      isPrimary: item.isPrimary,
      alt: item.alt ?? null,
      caption: item.caption ?? null,
    }))
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) {
        return a.isPrimary ? -1 : 1;
      }
      return a.sortOrder - b.sortOrder;
    });
}

function primaryPosterUrl(media: ProgramEventPosterMediaItem[]): string | null {
  return media.find((item) => item.isPrimary)?.url ?? media[0]?.url ?? null;
}

function programEventCreditToItem(credit: ProgramEventCredit): ProgramEventCreditItem {
  return {
    id: credit.id,
    artistId: credit.artistId ?? null,
    memberId: credit.memberId ?? null,
    displayName: credit.displayName ?? null,
    creditRole: credit.creditRole ?? null,
    description: credit.description ?? null,
    sortOrder: credit.sortOrder,
    artist: credit.artist
      ? {
          id: credit.artist.id,
          name: credit.artist.name,
          slug: credit.artist.slug ?? null,
          imageUrl: credit.artist.imageAsset?.url ?? null,
        }
      : null,
    member: credit.member
      ? {
          id: credit.member.id,
          name: credit.member.nickname,
          image: credit.member.avatarAsset?.url ?? null,
        }
      : null,
  };
}

function locationModeToProto(mode: ProgramEventLocationModeValue): ProgramEventLocationMode {
  switch (mode) {
    case 'online':
      return ProgramEventLocationMode.ONLINE;
    case 'hybrid':
      return ProgramEventLocationMode.HYBRID;
    case 'tba':
      return ProgramEventLocationMode.TBA;
    case 'map_place':
    default:
      return ProgramEventLocationMode.MAP_PLACE;
  }
}

function locationModeFromProto(mode: ProgramEventLocationMode): ProgramEventLocationModeValue {
  switch (mode) {
    case ProgramEventLocationMode.ONLINE:
      return 'online';
    case ProgramEventLocationMode.HYBRID:
      return 'hybrid';
    case ProgramEventLocationMode.TBA:
      return 'tba';
    case ProgramEventLocationMode.MAP_PLACE:
    default:
      return 'map_place';
  }
}

function programEventSeriesStatusToProto(status: ProgramEventSeriesStatusValue): ProgramEventSeriesStatus {
  return status === 'published' ? ProgramEventSeriesStatus.PUBLISHED : ProgramEventSeriesStatus.DRAFT;
}

function relationsToArtists(relations?: ProgramEventRelationInput[]) {
  return (relations ?? []).map((relation, index) =>
    create(ProgramEventArtistSchema, {
      artistId: relation.id,
      role: relation.role ?? undefined,
      sortOrder: relation.sortOrder ?? index,
    }),
  );
}

function relationsToLabels(relations?: ProgramEventRelationInput[]) {
  return (relations ?? []).map((relation, index) =>
    create(ProgramEventLabelSchema, {
      labelId: relation.id,
      role: relation.role ?? undefined,
      sortOrder: relation.sortOrder ?? index,
    }),
  );
}

function relationsToClients(relations?: ProgramEventRelationInput[]) {
  return (relations ?? []).map((relation, index) =>
    create(ProgramEventClientSchema, {
      clientId: relation.id,
      role: relation.role ?? undefined,
      sortOrder: relation.sortOrder ?? index,
    }),
  );
}

function creditsToProto(credits?: ProgramEventCreditInput[]) {
  return (credits ?? []).map((credit, index) =>
    create(ProgramEventCreditSchema, {
      id: credit.id ?? '',
      artistId: credit.artistId ?? undefined,
      memberId: credit.memberId ?? undefined,
      displayName: credit.displayName ?? undefined,
      creditRole: credit.creditRole ?? undefined,
      description: credit.description ?? undefined,
      sortOrder: credit.sortOrder ?? index,
    }),
  );
}

async function ensureProgramEventType(locale: string) {
  const typeClient = await createProgramEventTypeClient();
  const existing = await typeClient.listProgramEventTypesAdmin({
    pagination: { limit: 1, offset: 0 },
  });
  const first = existing.types[0];
  if (first) {
    return first.id;
  }

  const created = await typeClient.createProgramEventType({
    slug: 'event',
    locale,
    name: 'Event',
    sortOrder: 0,
  });
  return created.id;
}

export async function createProgramEventAction(timezone = 'UTC'): Promise<ActionResult<{ data: { id: string } }>> {
  return runAction(
    'program-event-actions',
    'createProgramEventAction',
    async () => {
      const locale = await getUserLocale();
      const typeId = await ensureProgramEventType(locale);
      const client = await createProgramEventClient();
      const now = new Date();
      const title = 'Untitled Event';
      const event = await client.createProgramEvent({
        title,
        slug: `${generateSlug(title)}-${Date.now()}`,
        sourceLocale: locale,
        typeId,
        startsAt: timestampFromDate(now),
        timezone,
        locationMode: ProgramEventLocationMode.TBA,
      });
      revalidatePath('/admin/events');
      return { data: { id: event.id } };
    },
    { fallback: 'Failed to create program event', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export async function updateProgramEventAction(
  id: string,
  data: {
    title?: string;
    slug?: string | null;
    summary?: string | null;
    typeId?: string;
    seriesId?: string | null;
    seriesOrder?: number | null;
    startsAt?: Date;
    endsAt?: Date | null;
    timezone?: string;
    allDay?: boolean;
    locationMode?: ProgramEventLocationModeValue;
    mapPlaceId?: string | null;
    posterFileId?: string | null;
    ticketUrl?: string | null;
    streamUrl?: string | null;
    externalUrl?: string | null;
    locale?: string | null;
    artists?: ProgramEventRelationInput[];
    labels?: ProgramEventRelationInput[];
    clients?: ProgramEventRelationInput[];
    credits?: ProgramEventCreditInput[];
    observed?: {
      artists?: ProgramEventRelationInput[];
      labels?: ProgramEventRelationInput[];
      clients?: ProgramEventRelationInput[];
    };
  },
  editorOrigin?: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'program-event-actions',
    'updateProgramEventAction',
    async () => {
      const client = await createProgramEventClient(editorOrigin);
      await client.updateProgramEvent({
        id,
        slug: data.slug === undefined ? undefined : toSlugInputValue(data.slug),
        typeId: data.typeId,
        seriesId: data.seriesId === undefined ? undefined : (data.seriesId ?? ''),
        seriesOrder: data.seriesOrder === null ? undefined : data.seriesOrder,
        clearSeriesOrder: data.seriesOrder === null,
        startsAt: data.startsAt ? timestampFromDate(data.startsAt) : undefined,
        endsAt: data.endsAt === undefined ? undefined : data.endsAt ? timestampFromDate(data.endsAt) : undefined,
        clearEndsAt: data.endsAt === null,
        timezone: data.timezone,
        allDay: data.allDay,
        locationMode: data.locationMode ? locationModeToProto(data.locationMode) : undefined,
        mapPlaceId: data.mapPlaceId === undefined ? undefined : (data.mapPlaceId ?? ''),
        posterFileId: data.posterFileId === undefined ? undefined : (data.posterFileId ?? ''),
        ticketUrl: data.ticketUrl === undefined ? undefined : (data.ticketUrl ?? ''),
        streamUrl: data.streamUrl === undefined ? undefined : (data.streamUrl ?? ''),
        externalUrl: data.externalUrl === undefined ? undefined : (data.externalUrl ?? ''),
        artists: data.artists ? relationsToArtists(data.artists) : [],
        labels: data.labels ? relationsToLabels(data.labels) : [],
        clients: data.clients ? relationsToClients(data.clients) : [],
        credits: data.credits ? creditsToProto(data.credits) : [],
        replaceArtists: data.artists !== undefined,
        replaceLabels: data.labels !== undefined,
        replaceClients: data.clients !== undefined,
        replaceCredits: data.credits !== undefined,
        observedArtists:
          data.observed?.artists === undefined
            ? undefined
            : create(ProgramEventArtistsSnapshotSchema, { artists: relationsToArtists(data.observed.artists) }),
        observedLabels:
          data.observed?.labels === undefined
            ? undefined
            : create(ProgramEventLabelsSnapshotSchema, { labels: relationsToLabels(data.observed.labels) }),
        observedClients:
          data.observed?.clients === undefined
            ? undefined
            : create(ProgramEventClientsSnapshotSchema, { clients: relationsToClients(data.observed.clients) }),
      });
      revalidatePath('/admin/events');
      revalidatePath(`/events/${id}`);
      return { success: true as const };
    },
    { fallback: 'Failed to update program event', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export interface ProgramEventNeutralConfiguration {
  slug: string | null;
  typeId: string;
  typeName: string | null;
  seriesId: string | null;
  seriesOrder: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  timezone: string;
  allDay: boolean;
  locationMode: ProgramEventLocationModeValue;
  mapPlaceId: string | null;
  ticketUrl: string | null;
  streamUrl: string | null;
  externalUrl: string | null;
  artists: ProgramEventRelationInput[];
  labels: ProgramEventRelationInput[];
  clients: ProgramEventRelationInput[];
}

/** Authorized neutral Event settings used to refresh another editor tab. */
export async function getProgramEventNeutralConfigurationAction(
  id: string,
): Promise<ActionResult<{ configuration: ProgramEventNeutralConfiguration }>> {
  return runAction(
    'program-event-actions',
    'getProgramEventNeutralConfigurationAction',
    async () => {
      const eventClient = await createProgramEventClient();
      const event = await eventClient.getProgramEvent({ id });
      const uiLocale = await getUserLocale();
      let typeName: string | null = null;
      try {
        const typeClient = await createProgramEventTypeClient();
        const typeResponse = await typeClient.listProgramEventTypesAdmin({
          pagination: { limit: 1, offset: 0 },
          filters: [create(FilterSpecSchema, { field: 'id', op: FilterOp.EQ, value: event.typeId })],
        });
        const selectedType = typeResponse.types.find((type) => type.id === event.typeId);
        typeName =
          selectedType?.locales.find((locale) => locale.locale === uiLocale)?.name ??
          selectedType?.locales.find((locale) => locale.locale === event.sourceLocale)?.name ??
          selectedType?.locales[0]?.name ??
          selectedType?.slug ??
          null;
      } catch (error) {
        if (!isConnectError(error) || error.code !== Code.PermissionDenied) {
          throw error;
        }
        logServerFailure('program-event-actions', 'getProgramEventNeutralConfigurationAction', error);
      }
      return {
        configuration: {
          slug: event.slug || null,
          typeId: event.typeId,
          typeName,
          seriesId: event.seriesId ?? null,
          seriesOrder: event.seriesOrder ?? null,
          startsAt: event.startsAt ? timestampDate(event.startsAt) : null,
          endsAt: event.endsAt ? timestampDate(event.endsAt) : null,
          timezone: event.timezone,
          allDay: event.allDay,
          locationMode: locationModeFromProto(event.locationMode),
          mapPlaceId: event.mapPlaceId ?? null,
          ticketUrl: event.ticketUrl || null,
          streamUrl: event.streamUrl || null,
          externalUrl: event.externalUrl || null,
          artists: event.artists.map((item) => ({
            id: item.artistId,
            role: item.role || null,
            sortOrder: item.sortOrder,
          })),
          labels: event.labels.map((item) => ({
            id: item.labelId,
            role: item.role || null,
            sortOrder: item.sortOrder,
          })),
          clients: event.clients.map((item) => ({
            id: item.clientId,
            role: item.role || null,
            sortOrder: item.sortOrder,
          })),
        },
      };
    },
    { fallback: 'Failed to load program event settings', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export async function publishProgramEventAction(
  id: string,
  editorOrigin?: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'program-event-actions',
    'publishProgramEventAction',
    async () => {
      const client = await createProgramEventClient(editorOrigin);
      await client.publishProgramEvent({ id });
      revalidatePath('/admin/events');
      revalidatePath(`/events/${id}`);
      return { success: true as const };
    },
    { fallback: 'Failed to publish program event', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export async function archiveProgramEventAction(
  id: string,
  editorOrigin?: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'program-event-actions',
    'archiveProgramEventAction',
    async () => {
      const client = await createProgramEventClient(editorOrigin);
      await client.archiveProgramEvent({ id });
      revalidatePath('/admin/events');
      revalidatePath(`/events/${id}`);
      return { success: true as const };
    },
    { fallback: 'Failed to archive program event', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export async function deleteProgramEventAction(id: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'program-event-actions',
    'deleteProgramEventAction',
    async () => {
      const client = await createProgramEventClient();
      await client.deleteProgramEvent({ id });
      revalidatePath('/admin/events');
      return { success: true as const };
    },
    { fallback: 'Failed to delete program event', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export async function addProgramEventPosterAction(
  eventId: string,
  fileId: string,
): Promise<ActionResult<{ media?: ProgramEventPosterMediaItem[]; imageUrl?: string | null }>> {
  return runAction(
    'program-event-actions',
    'addProgramEventPosterAction',
    async () => {
      const client = await createProgramEventClient();
      const event = await client.addProgramEventMedia({
        eventId,
        fileId,
        role: 'poster',
        makePrimary: false,
      });
      if (!event.media) {
        throw new Error('Program event media ACK is incomplete.');
      }
      const current = await client.getProgramEvent({ id: eventId });
      const media = await hydrateProgramEventPosterMedia(current.media);
      revalidatePath('/admin/events');
      revalidatePath(`/events/${eventId}`);
      return { media, imageUrl: primaryPosterUrl(media) };
    },
    { fallback: 'Failed to add program event poster', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export async function deleteProgramEventPosterAction(
  eventId: string,
  mediaId: string,
): Promise<ActionResult<{ media?: ProgramEventPosterMediaItem[]; imageUrl?: string | null }>> {
  return runAction(
    'program-event-actions',
    'deleteProgramEventPosterAction',
    async () => {
      const client = await createProgramEventClient();
      await client.deleteProgramEventMedia({ eventId, mediaId });
      const current = await client.getProgramEvent({ id: eventId });
      const media = await hydrateProgramEventPosterMedia(current.media);
      revalidatePath('/admin/events');
      revalidatePath(`/events/${eventId}`);
      return { media, imageUrl: primaryPosterUrl(media) };
    },
    { fallback: 'Failed to delete program event poster', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export async function reorderProgramEventPosterMediaAction(
  eventId: string,
  mediaIds: string[],
): Promise<ActionResult<{ media?: ProgramEventPosterMediaItem[]; imageUrl?: string | null }>> {
  return runAction(
    'program-event-actions',
    'reorderProgramEventPosterMediaAction',
    async () => {
      const client = await createProgramEventClient();
      await client.reorderProgramEventMedia({
        eventId,
        role: 'poster',
        mediaIds,
      });
      const current = await client.getProgramEvent({ id: eventId });
      const media = await hydrateProgramEventPosterMedia(current.media);
      revalidatePath('/admin/events');
      revalidatePath(`/events/${eventId}`);
      return { media, imageUrl: primaryPosterUrl(media) };
    },
    { fallback: 'Failed to reorder program event posters', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export async function addProgramEventCreditAction(
  eventId: string,
  data: {
    artistId?: string;
    memberId?: string;
    displayName?: string;
    creditRole?: string | null;
    description?: string | null;
    sortOrder?: number;
  },
): Promise<ActionResult<{ credit?: ProgramEventCreditItem }>> {
  return runAction(
    'program-event-actions',
    'addProgramEventCreditAction',
    async () => {
      const client = await createProgramEventClient();
      const credit = await client.addProgramEventCredit({
        eventId,
        artistId: data.artistId,
        memberId: data.memberId,
        displayName: data.displayName,
        creditRole: data.creditRole ?? undefined,
        description: data.description ?? undefined,
        sortOrder: data.sortOrder,
      });
      revalidatePath('/admin/events');
      revalidatePath(`/events/${eventId}`);
      return { credit: programEventCreditToItem(credit) };
    },
    { fallback: 'Failed to add program event credit', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export async function updateProgramEventCreditAction(
  eventId: string,
  creditId: string,
  data: { creditRole?: string | null; description?: string | null; sortOrder?: number },
): Promise<ActionResult<{ credit?: ProgramEventCreditItem }>> {
  return runAction(
    'program-event-actions',
    'updateProgramEventCreditAction',
    async () => {
      const client = await createProgramEventClient();
      const credit = await client.updateProgramEventCredit({
        eventId,
        creditId,
        creditRole: data.creditRole === undefined ? undefined : (data.creditRole ?? ''),
        description: data.description === undefined ? undefined : (data.description ?? ''),
        sortOrder: data.sortOrder,
      });
      revalidatePath('/admin/events');
      revalidatePath(`/events/${eventId}`);
      return { credit: programEventCreditToItem(credit) };
    },
    { fallback: 'Failed to update program event credit', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export async function deleteProgramEventCreditAction(
  eventId: string,
  creditId: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'program-event-actions',
    'deleteProgramEventCreditAction',
    async () => {
      const client = await createProgramEventClient();
      await client.deleteProgramEventCredit({ eventId, creditId });
      revalidatePath('/admin/events');
      revalidatePath(`/events/${eventId}`);
      return { success: true as const };
    },
    { fallback: 'Failed to delete program event credit', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export async function reorderProgramEventCreditsAction(
  eventId: string,
  creditIds: string[],
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'program-event-actions',
    'reorderProgramEventCreditsAction',
    async () => {
      const client = await createProgramEventClient();
      await client.reorderProgramEventCredits({ eventId, creditIds });
      revalidatePath('/admin/events');
      revalidatePath(`/events/${eventId}`);
      return { success: true as const };
    },
    { fallback: 'Failed to reorder program event credits', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export async function searchArtistsForProgramEventCreditAction(_eventId: string, rawQuery: string) {
  return queryResult(async () => {
    const query = rawQuery.trim();
    if (!query) {
      return [];
    }

    const client = await createArtistClient();
    const response = await client.listArtists({
      pagination: { limit: 10, offset: 0 },
      filters: [create(FilterSpecSchema, { field: 'search', op: FilterOp.ILIKE, value: query })],
      sorts: [{ field: 'name', order: SortOrder.ASC }],
    });
    return (response.artists ?? []).map((artist) => ({
      id: artist.id,
      name: artist.name,
      imageUrl: artist.imageAsset?.url ?? null,
    }));
  });
}

export async function createProgramEventTypeAction(input?: {
  name?: string;
  slug?: string;
  sortOrder?: number;
  description?: string | null;
  requiresPlace?: boolean;
  requiresStreamUrl?: boolean;
}): Promise<ActionResult<{ data: { id: string; name: string; slug: string } }>> {
  return runAction(
    'program-event-actions',
    'createProgramEventTypeAction',
    async () => {
      const client = await createProgramEventTypeClient();
      const locale = await getUserLocale();
      const fallbackName = 'New Event Type';
      const name = input?.name?.trim() || fallbackName;
      const slug = input?.slug?.trim() || generateSlug(name) || `event-type-${Date.now()}`;
      const created = await client.createProgramEventType({
        slug,
        locale,
        name,
        sortOrder: input?.sortOrder ?? 0,
        description: input?.description ?? '',
        requiresPlace: input?.requiresPlace ?? false,
        requiresStreamUrl: input?.requiresStreamUrl ?? false,
      });
      revalidatePath('/admin/events');
      return { data: { id: created.id, name, slug } };
    },
    { fallback: 'Failed to create program event type', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export async function updateProgramEventTypeAction(
  id: string,
  input: {
    locale: string;
    name: string;
    description?: string | null;
    slug: string;
    status: 'active' | 'inactive';
    sortOrder: number;
    requiresPlace: boolean;
    requiresStreamUrl: boolean;
  },
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'program-event-actions',
    'updateProgramEventTypeAction',
    async () => {
      const client = await createProgramEventTypeClient();
      await client.updateProgramEventType({
        id,
        locale: input.locale,
        name: input.name,
        description: input.description ?? '',
        slug: input.slug,
        status: input.status === 'active' ? ProgramEventTypeStatus.ACTIVE : ProgramEventTypeStatus.INACTIVE,
        sortOrder: input.sortOrder,
        requiresPlace: input.requiresPlace,
        requiresStreamUrl: input.requiresStreamUrl,
      });
      revalidatePath('/admin/events');
      return { success: true as const };
    },
    { fallback: 'Failed to update program event type', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export async function deleteProgramEventTypeAction(id: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'program-event-actions',
    'deleteProgramEventTypeAction',
    async () => {
      const client = await createProgramEventTypeClient();
      await client.deleteProgramEventType({ id });
      revalidatePath('/admin/events');
      return { success: true as const };
    },
    { fallback: 'Failed to delete program event type', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export async function createProgramEventSeriesAction(): Promise<ActionResult<{ data: { id: string } }>> {
  return runAction(
    'program-event-actions',
    'createProgramEventSeriesAction',
    async () => {
      const client = await createProgramEventSeriesClient();
      const title = 'New Event Series';
      const created = await client.createProgramEventSeries({
        title,
        slug: `${generateSlug(title)}-${Date.now()}`,
      });
      revalidatePath('/admin/events');
      revalidatePath('/admin/event-series');
      return { data: { id: created.id } };
    },
    { fallback: 'Failed to create program event series', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export async function deleteProgramEventSeriesAction(id: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'program-event-actions',
    'deleteProgramEventSeriesAction',
    async () => {
      const client = await createProgramEventSeriesClient();
      await client.deleteProgramEventSeries({ id });
      revalidatePath('/admin/events');
      revalidatePath('/admin/event-series');
      return { success: true as const };
    },
    { fallback: 'Failed to delete program event series', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export async function updateProgramEventSeriesAction(
  id: string,
  data: {
    title?: string;
    slug?: string;
    summary?: string | null;
    description?: string | null;
    posterFileId?: string | null;
    status?: ProgramEventSeriesStatusValue;
  },
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'program-event-actions',
    'updateProgramEventSeriesAction',
    async () => {
      const client = await createProgramEventSeriesClient();
      await client.updateProgramEventSeries({
        id,
        title: data.title,
        slug: data.slug,
        summary: data.summary === undefined ? undefined : (data.summary ?? ''),
        description: data.description === undefined ? undefined : (data.description ?? ''),
        posterFileId: data.posterFileId === undefined ? undefined : (data.posterFileId ?? ''),
        status: data.status ? programEventSeriesStatusToProto(data.status) : undefined,
      });
      revalidatePath('/admin/events');
      revalidatePath('/admin/event-series');
      revalidatePath(`/event-series/${id}`);
      return { success: true as const };
    },
    { fallback: 'Failed to update program event series', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export async function setProgramEventSeriesPosterAction(
  id: string,
  fileId: string,
): Promise<ActionResult<{ imageUrl: string | null }>> {
  // The series update logs and reports its own failure.
  const result = await updateProgramEventSeriesAction(id, { posterFileId: fileId });
  if (!result.ok) {
    return result;
  }
  return runAction(
    'program-event-actions',
    'setProgramEventSeriesPosterAction',
    async () => {
      const fileClient = await createFileClient();
      const file = await fileClient.getMediaDelivery({ fileId });
      return {
        imageUrl: file.delivery?.thumbnail?.url || file.delivery?.asset?.url || file.delivery?.inline?.url || null,
      };
    },
    { fallback: 'Failed to set event series image', messages: PROGRAM_EVENT_FAILURE_MESSAGES },
  );
}

export async function removeProgramEventSeriesPosterAction(id: string) {
  return updateProgramEventSeriesAction(id, { posterFileId: '' });
}
