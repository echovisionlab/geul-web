'use server';

import { isConnectErrorCode } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { create } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import {
  FilterOp,
  FilterSpecSchema,
  SortSpecSchema,
  type SortOrder,
} from '@echovisionlab/geul-proto/common/common_pb.ts';
import { ArtistParticipantRole } from '@echovisionlab/geul-proto/secure/artist_pb.ts';
import {
  createArtistClient,
  createPublicArtistClient,
  createPublicArtistClientWithAuth,
} from '@/lib/api/server-client';
import { regenerateOgImageAction as requestOgImageRegeneration } from '@/lib/actions/og-generation';
import { getLocalizedNewEntityName } from '@/lib/i18n/default-entity-name.server';
import { isValidUuid } from '@/lib/utils/validation';

// Simple list for selectors (published only)
export async function listArtistsAction() {
  try {
    const client = await createArtistClient();
    const response = await client.listArtists({
      pagination: { limit: 100, offset: 0 },
    });
    return (response.artists ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug ?? null,
      imageUrl: a.imageAsset?.url ?? null,
    }));
  } catch (err) {
    return [];
  }
}

export async function listArtistParentOptionsAction(artistId: string) {
  try {
    const client = await createArtistClient();
    const [published, manageable] = await Promise.all([
      client.listArtists({ pagination: { limit: 200, offset: 0 } }),
      client.listMyArtists({ pagination: { limit: 200, offset: 0 } }),
    ]);
    const candidates = new Map(
      [...(published.artists ?? []), ...(manageable.artists ?? [])].map((artist) => [artist.id, artist]),
    );
    candidates.delete(artistId);
    return [...candidates.values()]
      .map((artist) => ({ id: artist.id, name: artist.name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  } catch {
    return [];
  }
}

export async function createArtistDraftAction(): Promise<{
  data?: { id: string };
  error?: string;
}> {
  try {
    const client = await createArtistClient();
    const name = await getLocalizedNewEntityName('artist');
    const artist = await client.createArtist({
      name,
    });
    revalidatePath('/admin/artists');
    return { data: { id: artist.id } };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create artist draft' };
  }
}

export async function previewDeleteArtistAction(id: string) {
  try {
    const client = await createArtistClient();
    const response = await client.previewDeleteArtist({ id });
    return {
      data: {
        revision: response.revision,
        totalRelationCount: response.totalRelationCount,
        impacts: response.impacts.map((impact) => ({
          domain: impact.domain,
          entityId: impact.entityId,
          label: impact.label,
          relationCount: impact.relationCount,
        })),
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to preview artist deletion' };
  }
}

export async function deleteArtistAction(
  id: string,
  expectedRevision: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createArtistClient();
    await client.deleteArtist({ id, expectedRevision });
    revalidatePath('/admin/artists');
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete artist' };
  }
}

export async function publishArtistAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createArtistClient();
    await client.publishArtist({ id });
    revalidatePath('/admin/artists');
    revalidatePath(`/artists/${id}`);
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to publish artist' };
  }
}

export async function unpublishArtistAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createArtistClient();
    await client.unpublishArtist({ id });
    revalidatePath('/admin/artists');
    revalidatePath(`/artists/${id}`);
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to unpublish artist' };
  }
}

interface ArtistListInput {
  filter?: unknown;
  filterBy?: 'AND' | 'OR';
  sort?: { field: string; order?: 'asc' | 'desc' }[];
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

export async function listArtistsAdminAction(input: ArtistListInput) {
  try {
    const client = await createArtistClient();
    const limit = input.pageSize ?? 20;
    const page = input.page ?? 1;
    const offset = (page - 1) * limit;

    const sorts = input.sort?.map((s) => ({
      field: s.field,
      order: (s.order === 'desc' ? 2 : 1) as SortOrder,
    }));

    const filters = [];
    if (input.search) {
      filters.push(create(FilterSpecSchema, { field: 'search', op: FilterOp.ILIKE, value: input.search }));
    }
    if (input.status) {
      filters.push(create(FilterSpecSchema, { field: 'status', op: FilterOp.EQ, value: input.status }));
    }

    const response = await client.listArtistsAdmin({
      pagination: { limit, offset },
      filters,
      sorts,
    });

    const total = response.pagination?.total ?? 0;

    return {
      data: (response.artists ?? []).map((aws) => ({
        id: aws.artist?.id ?? '',
        name: aws.artist?.name ?? '',
        slug: aws.artist?.slug ?? null,
        imageUrl: aws.artist?.imageAsset?.url ?? null,
        status: aws.artist?.status ?? 'draft',
        releaseCount: aws.releaseCount,
        createdAt: aws.artist?.createdAt ? timestampDate(aws.artist.createdAt) : null,
        updatedAt: aws.artist?.updatedAt ? timestampDate(aws.artist.updatedAt) : null,
      })),
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }
}

export async function getArtistAdminAction(idOrSlug: string) {
  try {
    const decoded = decodeURIComponent(idOrSlug);
    let artistId = decoded;

    if (!isValidUuid(artistId)) {
      const publicClient = await createPublicArtistClientWithAuth();
      const publicResponse = await publicClient.get({ slug: decoded });
      if (!publicResponse.artist?.id) {
        return null;
      }
      artistId = publicResponse.artist.id;
    }

    const client = await createArtistClient();
    const response = await client.getArtistEditorData({ id: artistId });
    const artist = response.artist;
    if (!artist) {
      return null;
    }
    return {
      id: artist.id,
      name: artist.name,
      slug: artist.slug ?? null,
      realName: artist.realName ?? null,
      document: artist.document ?? null,
      countryCode: artist.countryCode ?? null,
      website: artist.website ?? null,
      imageUrl: artist.imageAsset?.url ?? null,
      ogImageUrl: artist.ogAsset?.url ?? null,
      images: (artist.images ?? []).map((image) => ({
        fileId: image.fileId,
        url: image.asset?.url ?? null,
        sortOrder: image.sortOrder,
        primary: image.primary,
      })),
      imageRevision: response.imageRevision,
      socialLinks: artist.socialLinks ?? {},
      status: artist.status,
      publishedAt: artist.publishedAt ? timestampDate(artist.publishedAt) : null,
      createdAt: artist.createdAt ? timestampDate(artist.createdAt) : null,
      updatedAt: artist.updatedAt ? timestampDate(artist.updatedAt) : null,
      labelIds: response.labelIds ?? [],
      parentArtistId: artist.parentArtistId ?? null,
      allowedActions: response.allowedActions ?? [],
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    if (isConnectErrorCode(err, Code.PermissionDenied)) {
      return null;
    }
    throw err;
  }
}

export async function regenerateArtistOgImageAction(
  artistId: string,
  locale: string,
): Promise<{ success?: boolean; runId?: string; generationId?: string; error?: string }> {
  const result = await requestOgImageRegeneration({
    entityType: 'artist',
    entityId: artistId,
    selection: { type: 'locale', locale },
  });
  if (result.error) {
    return { error: result.error };
  }
  return { success: true, runId: result.runId, generationId: result.generationIds?.[0] };
}

export async function deleteArtistAvatarAction(artistId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createArtistClient();
    await client.deleteArtistImage({ artistId });
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete avatar' };
  }
}

export async function setArtistImageAction(
  artistId: string,
  fileId: string,
): Promise<{ url?: string; error?: string }> {
  try {
    const client = await createArtistClient();
    const response = await client.setArtistImage({ artistId, fileId });
    return { url: response.imageAsset?.url };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Artist or file not found' };
    }
    if (isConnectErrorCode(err, Code.PermissionDenied)) {
      return { error: 'No permission to edit this artist' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to set artist image' };
  }
}

export async function setArtistImagesAction(
  artistId: string,
  fileIds: string[],
  expectedRevision: string,
): Promise<{
  data?: {
    images: { fileId: string; url: string | null; sortOrder: number; primary: boolean }[];
    revision: string;
  };
  error?: string;
}> {
  try {
    const client = await createArtistClient();
    const response = await client.setArtistImages({ artistId, fileIds, expectedRevision });
    return {
      data: {
        images: response.images.map((image) => ({
          fileId: image.fileId,
          url: image.asset?.url ?? null,
          sortOrder: image.sortOrder,
          primary: image.primary,
        })),
        revision: response.revision,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update artist images' };
  }
}

// User-scoped list (for /my/artists page) - artists where user is editor
export async function listMyArtistsAction(input: ArtistListInput) {
  try {
    const client = await createArtistClient();
    const limit = input.pageSize ?? 20;
    const page = input.page ?? 1;
    const offset = (page - 1) * limit;

    const sorts = input.sort?.map((s) => ({
      field: s.field,
      order: (s.order === 'desc' ? 2 : 1) as SortOrder,
    }));

    const response = await client.listMyArtists({
      pagination: { limit, offset },
      filters: input.search ? [{ field: 'search', op: FilterOp.ILIKE, value: input.search }] : undefined,
      sorts,
    });

    const total = response.pagination?.total ?? 0;

    return {
      data: (response.artists ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug ?? null,
        imageUrl: a.imageAsset?.url ?? null,
        status: a.status,
        createdAt: a.createdAt ? timestampDate(a.createdAt) : null,
      })),
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }
}

// Public: list artists for page blocks (published only)
export async function listArtistsForBlockAction(input: {
  labelIds?: string[];
  sortBy?: 'name' | 'published_at';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  requestedLocale?: string | null;
}) {
  try {
    const client = input.requestedLocale
      ? await createPublicArtistClientWithAuth(input.requestedLocale)
      : createPublicArtistClient();
    const filters = [];
    if (input.labelIds && input.labelIds.length > 0) {
      filters.push(
        create(FilterSpecSchema, {
          field: 'label_id',
          op: FilterOp.IN,
          values: input.labelIds,
        }),
      );
    }
    const limit = input.limit ?? 12;
    const offset = input.offset ?? 0;
    const response = await client.list({
      pagination: { limit, offset },
      filters,
      sorts: [
        create(SortSpecSchema, {
          field: input.sortBy ?? 'name',
          order: (input.sortOrder === 'desc' ? 2 : 1) as SortOrder,
        }),
      ],
    });

    return {
      artists: (response.artists ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug ?? null,
        imageUrl: a.imageAsset?.url ?? null,
        socialLinks: a.socialLinks ?? null,
        publishedAt: a.publishedAt ? timestampDate(a.publishedAt) : null,
      })),
      pagination: {
        total: response.pagination?.total ?? 0,
        limit,
        offset,
      },
    };
  } catch (err) {
    return {
      artists: [],
      pagination: {
        total: 0,
        limit: input.limit ?? 12,
        offset: input.offset ?? 0,
      },
    };
  }
}

// === Durable Owner and Manager participants ===

export async function listArtistParticipantsAction(artistId: string) {
  try {
    const client = await createArtistClient();
    const response = await client.listArtistParticipants({ artistId });
    return (response.participants ?? []).map((participant) => ({
      memberId: participant.member?.id ?? '',
      nickname: participant.member?.nickname ?? '',
      avatarUrl: participant.member?.avatarAsset?.url ?? null,
      role: participant.role,
      hasEffectiveAuthority: participant.hasEffectiveAuthority,
    }));
  } catch (err) {
    return [];
  }
}

export async function setArtistParticipantAction(
  artistId: string,
  memberId: string,
  role: ArtistParticipantRole,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createArtistClient();
    await client.setArtistParticipant({ artistId, memberId, role });
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Artist or member not found' };
    }
    if (isConnectErrorCode(err, Code.AlreadyExists)) {
      return { error: 'Member already has this role' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update participant' };
  }
}

export async function removeArtistParticipantAction(
  artistId: string,
  memberId: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createArtistClient();
    await client.removeArtistParticipant({ artistId, memberId });
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to remove participant' };
  }
}
