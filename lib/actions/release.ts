'use server';

import { connectActionErrorCode, connectActionErrorMessage, isConnectErrorCode } from '@/lib/api/connect-error';
import {
  actionFailure,
  actionSuccess,
  type ActionResult,
  type LocalActionErrorCode,
} from '@/lib/actions/action-result';
import { revalidatePath } from 'next/cache';
import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { createReleaseClient } from '@/lib/api/server-client';
import { releaseTypeToString, stringToReleaseType } from '@/lib/types/release/proto';
import { parseReleaseStatus } from '@/lib/types/release/schema';
import type {
  ReleaseArtistItem,
  ReleaseCategoryItem,
  ReleaseCreditItem,
  ReleaseFormatItem,
  ReleaseGenreItem,
  ReleaseLabelItem,
  ReleaseStyleItem,
} from '@/lib/types/release/model';
import { toSlugInputValue } from '@/lib/utils/slug';

function releaseActionFailure(
  error: unknown,
  fallback: string,
  fallbackCode: LocalActionErrorCode,
  messages: Readonly<Partial<Record<Code, string>>> = {},
): { ok: false; error: string; errorCode: Code | LocalActionErrorCode } {
  const message = connectActionErrorMessage(error, fallback, {
    [Code.Unauthenticated]: 'Unauthorized',
    ...messages,
  });
  return actionFailure(message.trim() ? message : fallback, connectActionErrorCode(error, fallbackCode));
}

function releaseEditorFailure(error: unknown, fallback: string, fallbackCode: LocalActionErrorCode) {
  return releaseActionFailure(error, fallback, fallbackCode, {
    [Code.NotFound]: 'Release not found',
    [Code.PermissionDenied]: 'No permission to edit this release',
  });
}

export async function createReleaseAction(data: {
  title: string;
  type: 'album' | 'ep' | 'single' | 'compilation';
}): Promise<ActionResult<{ data: { id: string } }>> {
  try {
    const client = await createReleaseClient();
    const release = await client.createRelease({
      title: data.title,
      type: stringToReleaseType(data.type),
    });
    revalidatePath('/admin/releases');
    return actionSuccess({ data: { id: release.id } });
  } catch (err) {
    return releaseActionFailure(err, 'Failed to create release', 'RELEASE_CREATE_FAILED');
  }
}

export async function deleteReleaseAction(id: string): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createReleaseClient();
    await client.deleteRelease({ id });
    revalidatePath('/admin/releases');
    return actionSuccess({ success: true });
  } catch (err) {
    return releaseActionFailure(err, 'Failed to delete release', 'RELEASE_DELETE_FAILED');
  }
}

export async function getReleaseAdminAction(id: string) {
  try {
    const client = await createReleaseClient();
    const release = await client.getRelease({ id });

    return {
      id: release.id,
      title: release.title,
      slug: release.slug ?? null,
      type: releaseTypeToString(release.type),
      document: release.document ?? null,
      artworkUrl: release.artworkAsset?.url ?? null,
      releaseDate: release.releaseDate ? timestampDate(release.releaseDate) : null,
      spotifyUrl: release.spotifyUrl ?? null,
      appleMusicUrl: release.appleMusicUrl ?? null,
      bandcampUrl: release.bandcampUrl ?? null,
      youtubeMusicUrl: release.youtubeMusicUrl ?? null,
      status: parseReleaseStatus(release.status),
      publishedAt: release.publishedAt ? timestampDate(release.publishedAt) : null,
      createdAt: release.createdAt ? timestampDate(release.createdAt) : null,
      updatedAt: release.updatedAt ? timestampDate(release.updatedAt) : null,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound, Code.PermissionDenied)) {
      return null;
    }
    throw err;
  }
}

export async function getReleaseEditorRelationsAction(releaseId: string): Promise<{
  artists: ReleaseArtistItem[];
  labels: ReleaseLabelItem[];
  categories: ReleaseCategoryItem[];
  genres: ReleaseGenreItem[];
  styles: ReleaseStyleItem[];
  formats: ReleaseFormatItem[];
  credits: ReleaseCreditItem[];
} | null> {
  try {
    const client = await createReleaseClient();
    const response = await client.getReleaseRelations({ releaseId });
    return {
      artists: (response.artists ?? []).map((artist) => ({
        artist_id: artist.artistId,
        artist_name: artist.artistName,
        artist_slug: artist.artistSlug ?? null,
        sort_order: artist.sortOrder,
      })),
      labels: (response.labels ?? []).map((label) => ({
        label_id: label.labelId,
        label_name: label.labelName,
        label_slug: label.labelSlug ?? null,
        catalog_number: label.catalogNumber ?? null,
        sort_order: label.sortOrder,
      })),
      categories: (response.categories ?? []).map(({ id, name, slug }) => ({ id, name, slug })),
      genres: (response.genres ?? []).map(({ id, name, slug }) => ({ id, name, slug })),
      styles: (response.styles ?? []).map(({ id, name, slug }) => ({ id, name, slug })),
      formats: (response.formats ?? []).map((format) => ({
        id: format.id,
        name: format.name,
        slug: format.slug,
        format_description: format.formatDescription ?? null,
      })),
      credits: (response.credits ?? []).map((credit) => ({
        id: credit.id,
        credit_type: credit.artistId ? 'artist' : credit.memberId ? 'member' : 'text',
        artist_id: credit.artistId ?? null,
        artist_name: credit.artistName ?? null,
        artist_slug: credit.artistSlug ?? null,
        member_id: credit.memberId ?? null,
        member_name: credit.memberName ?? null,
        credited_name: credit.creditedName ?? null,
        credit_role: credit.creditRole ?? null,
        sort_order: credit.sortOrder,
      })),
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound, Code.PermissionDenied)) {
      return null;
    }
    throw err;
  }
}

export async function publishReleaseAction(id: string): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createReleaseClient();
    await client.publishRelease({ id });
    revalidatePath('/admin/releases');
    return actionSuccess({ success: true });
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to publish release', 'RELEASE_PUBLISH_FAILED');
  }
}

export async function unpublishReleaseAction(id: string): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createReleaseClient();
    await client.unpublishRelease({ id });
    revalidatePath('/admin/releases');
    return actionSuccess({ success: true });
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to unpublish release', 'RELEASE_UNPUBLISH_FAILED');
  }
}

export async function updateReleaseSlugAction(
  id: string,
  slug: string | null,
): Promise<ActionResult<{ success: true; slug: string | null }>> {
  try {
    const client = await createReleaseClient();
    await client.updateRelease({
      id,
      slug: toSlugInputValue(slug),
    });
    return actionSuccess({ success: true, slug });
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to update slug', 'RELEASE_UPDATE_SLUG_FAILED');
  }
}

export async function updateReleaseFieldsAction(
  id: string,
  data: {
    type?: string;
    releaseDate?: Date | null;
    spotifyUrl?: string | null;
    appleMusicUrl?: string | null;
    bandcampUrl?: string | null;
    youtubeMusicUrl?: string | null;
  },
): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createReleaseClient();
    await client.updateRelease({
      id,
      type: data.type === undefined ? undefined : stringToReleaseType(data.type),
      releaseDateChange:
        data.releaseDate === undefined
          ? undefined
          : data.releaseDate === null
            ? { case: 'clearReleaseDate', value: {} }
            : { case: 'setReleaseDate', value: timestampFromDate(data.releaseDate) },
      spotifyUrl: data.spotifyUrl === null ? '' : data.spotifyUrl,
      appleMusicUrl: data.appleMusicUrl === null ? '' : data.appleMusicUrl,
      bandcampUrl: data.bandcampUrl === null ? '' : data.bandcampUrl,
      youtubeMusicUrl: data.youtubeMusicUrl === null ? '' : data.youtubeMusicUrl,
    });
    revalidatePath(`/releases/${id}`);
    return actionSuccess({ success: true });
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to update release fields', 'RELEASE_UPDATE_FIELDS_FAILED');
  }
}

// === Artwork Actions ===

export async function setReleaseArtworkAction(
  releaseId: string,
  fileId: string,
): Promise<ActionResult<{ url?: string }>> {
  try {
    const client = await createReleaseClient();
    const response = await client.setReleaseArtwork({ releaseId, fileId });
    return actionSuccess({ url: response.artworkAsset?.url });
  } catch (err) {
    return releaseActionFailure(err, 'Failed to set artwork', 'RELEASE_SET_ARTWORK_FAILED', {
      [Code.NotFound]: 'Release or file not found',
      [Code.PermissionDenied]: 'No permission to edit this release',
    });
  }
}

export async function deleteReleaseArtworkAction(releaseId: string): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createReleaseClient();
    await client.deleteReleaseArtwork({ releaseId });
    return actionSuccess({ success: true });
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to delete artwork', 'RELEASE_DELETE_ARTWORK_FAILED');
  }
}

// === Metadata Operations ===
// These use the secure ReleaseService API (requires edit permission)

export async function setReleaseLabelsAction(
  releaseId: string,
  labels: { labelId: string; catalogNumber?: string; sortOrder: number }[],
  observedLabels: { labelId: string; catalogNumber?: string; sortOrder: number }[],
  orderIntent?: { itemId: string; previousItemId?: string; nextItemId?: string },
): Promise<ActionResult<{ success: true }>> {
  if (!Array.isArray(observedLabels)) {
    return actionFailure('An observed label snapshot is required', Code.InvalidArgument);
  }
  try {
    const client = await createReleaseClient();
    await client.setReleaseLabels({
      releaseId,
      labels: labels.map((l) => ({
        labelId: l.labelId,
        catalogNumber: l.catalogNumber,
        sortOrder: l.sortOrder,
      })),
      observed: {
        labels: observedLabels.map((l) => ({
          labelId: l.labelId,
          catalogNumber: l.catalogNumber,
          sortOrder: l.sortOrder,
        })),
      },
      ...(orderIntent ? { orderIntent } : {}),
    });
    return actionSuccess({ success: true });
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to update labels', 'RELEASE_UPDATE_LABELS_FAILED');
  }
}

export async function setReleaseGenresAction(
  releaseId: string,
  genreIds: string[],
  observedIds: string[],
): Promise<ActionResult<{ success: true }>> {
  if (!Array.isArray(observedIds)) {
    return actionFailure('An observed genre snapshot is required', Code.InvalidArgument);
  }
  try {
    const client = await createReleaseClient();
    await client.setReleaseGenres({
      releaseId,
      genreIds,
      observed: { ids: observedIds },
    });
    return actionSuccess({ success: true });
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to update genres', 'RELEASE_UPDATE_GENRES_FAILED');
  }
}

export async function setReleaseArtistsAction(
  releaseId: string,
  artists: { artistId: string; sortOrder: number }[],
  observedArtists: { artistId: string; sortOrder: number }[],
  orderIntent?: { itemId: string; previousItemId?: string; nextItemId?: string },
): Promise<ActionResult<{ success: true }>> {
  if (!Array.isArray(observedArtists)) {
    return actionFailure('An observed artist snapshot is required', Code.InvalidArgument);
  }
  try {
    const client = await createReleaseClient();
    await client.setReleaseArtists({
      releaseId,
      artists: artists.map((artist) => ({
        artistId: artist.artistId,
        sortOrder: artist.sortOrder,
      })),
      observed: {
        artists: observedArtists.map((artist) => ({
          artistId: artist.artistId,
          sortOrder: artist.sortOrder,
        })),
      },
      ...(orderIntent ? { orderIntent } : {}),
    });
    return actionSuccess({ success: true });
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to update artists', 'RELEASE_UPDATE_ARTISTS_FAILED');
  }
}

export async function setReleaseCategoriesAction(
  releaseId: string,
  categoryIds: string[],
  observedIds: string[],
): Promise<ActionResult<{ success: true }>> {
  if (!Array.isArray(observedIds)) {
    return actionFailure('An observed category snapshot is required', Code.InvalidArgument);
  }
  try {
    const client = await createReleaseClient();
    await client.setReleaseCategories({
      releaseId,
      categoryIds,
      observed: { ids: observedIds },
    });
    return actionSuccess({ success: true });
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to update categories', 'RELEASE_UPDATE_CATEGORIES_FAILED');
  }
}

export async function setReleaseStylesAction(
  releaseId: string,
  styleIds: string[],
  observedIds: string[],
): Promise<ActionResult<{ success: true }>> {
  if (!Array.isArray(observedIds)) {
    return actionFailure('An observed style snapshot is required', Code.InvalidArgument);
  }
  try {
    const client = await createReleaseClient();
    await client.setReleaseStyles({
      releaseId,
      styleIds,
      observed: { ids: observedIds },
    });
    return actionSuccess({ success: true });
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to update styles', 'RELEASE_UPDATE_STYLES_FAILED');
  }
}

export async function setReleaseFormatsAction(
  releaseId: string,
  formats: { formatId: string; formatDescription?: string }[],
  observedFormats: { formatId: string; formatDescription?: string }[],
): Promise<ActionResult<{ success: true }>> {
  if (!Array.isArray(observedFormats)) {
    return actionFailure('An observed format snapshot is required', Code.InvalidArgument);
  }
  try {
    const client = await createReleaseClient();
    await client.setReleaseFormats({
      releaseId,
      formats: formats.map((f) => ({
        formatId: f.formatId,
        formatDescription: f.formatDescription,
      })),
      observed: {
        formats: observedFormats.map((f) => ({
          formatId: f.formatId,
          formatDescription: f.formatDescription,
        })),
      },
    });
    return actionSuccess({ success: true });
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to update formats', 'RELEASE_UPDATE_FORMATS_FAILED');
  }
}

export async function setReleaseCreditsAction(
  releaseId: string,
  credits: {
    id?: string;
    artistId?: string | null;
    memberId?: string | null;
    creditedName?: string | null;
    creditRole?: string | null;
    sortOrder: number;
  }[],
  observedCredits: {
    id?: string;
    artistId?: string | null;
    memberId?: string | null;
    creditedName?: string | null;
    creditRole?: string | null;
    sortOrder: number;
  }[],
  orderIntent?: { itemId: string; previousItemId?: string; nextItemId?: string },
): Promise<ActionResult<{ success: true }>> {
  if (!Array.isArray(observedCredits)) {
    return actionFailure('An observed credit snapshot is required', Code.InvalidArgument);
  }
  try {
    const client = await createReleaseClient();
    await client.setReleaseCredits({
      releaseId,
      credits: credits.map((c) => ({
        id: c.id,
        artistId: c.artistId ?? undefined,
        memberId: c.memberId ?? undefined,
        creditedName: c.creditedName ?? undefined,
        creditRole: c.creditRole ?? undefined,
        sortOrder: c.sortOrder,
      })),
      observed: {
        credits: observedCredits.map((c) => ({
          id: c.id,
          artistId: c.artistId ?? undefined,
          memberId: c.memberId ?? undefined,
          creditedName: c.creditedName ?? undefined,
          creditRole: c.creditRole ?? undefined,
          sortOrder: c.sortOrder,
        })),
      },
      ...(orderIntent ? { orderIntent } : {}),
    });
    return actionSuccess({ success: true });
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to update credits', 'RELEASE_UPDATE_CREDITS_FAILED');
  }
}
