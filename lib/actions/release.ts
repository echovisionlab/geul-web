'use server';

import { connectActionErrorMessage, isConnectErrorCode } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { createReleaseClient } from '@/lib/api/server-client';
import { releaseTypeToString, stringToReleaseType } from '@/lib/types/release/proto';
import { parseReleaseStatus } from '@/lib/types/release/schema';
import { toSlugInputValue } from '@/lib/utils/slug';

function releaseActionFailure(
  error: unknown,
  fallback: string,
  messages: Readonly<Partial<Record<Code, string>>> = {},
): { error: string } {
  return {
    error: connectActionErrorMessage(error, fallback, {
      [Code.Unauthenticated]: 'Unauthorized',
      ...messages,
    }),
  };
}

function releaseEditorFailure(error: unknown, fallback: string): { error: string } {
  return releaseActionFailure(error, fallback, {
    [Code.NotFound]: 'Release not found',
    [Code.PermissionDenied]: 'No permission to edit this release',
  });
}

export async function createReleaseAction(data: {
  title: string;
  type: 'album' | 'ep' | 'single' | 'compilation';
}): Promise<{ data?: { id: string }; error?: string }> {
  try {
    const client = await createReleaseClient();
    const release = await client.createRelease({
      title: data.title,
      type: stringToReleaseType(data.type),
    });
    revalidatePath('/admin/releases');
    return { data: { id: release.id } };
  } catch (err) {
    return releaseActionFailure(err, 'Failed to create release');
  }
}

export async function deleteReleaseAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createReleaseClient();
    await client.deleteRelease({ id });
    revalidatePath('/admin/releases');
    return { success: true };
  } catch (err) {
    return releaseActionFailure(err, 'Failed to delete release');
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

export async function publishReleaseAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createReleaseClient();
    await client.publishRelease({ id });
    revalidatePath('/admin/releases');
    return { success: true };
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to publish release');
  }
}

export async function unpublishReleaseAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createReleaseClient();
    await client.unpublishRelease({ id });
    revalidatePath('/admin/releases');
    return { success: true };
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to unpublish release');
  }
}

export async function updateReleaseSlugAction(
  id: string,
  slug: string | null,
): Promise<{ success?: boolean; slug?: string | null; error?: string }> {
  try {
    const client = await createReleaseClient();
    await client.updateRelease({
      id,
      slug: toSlugInputValue(slug),
    });
    return { success: true, slug };
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to update slug');
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
): Promise<{ success?: boolean; error?: string }> {
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
    return { success: true };
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to update release fields');
  }
}

// === Artwork Actions ===

export async function setReleaseArtworkAction(
  releaseId: string,
  fileId: string,
): Promise<{ url?: string; error?: string }> {
  try {
    const client = await createReleaseClient();
    const response = await client.setReleaseArtwork({ releaseId, fileId });
    return { url: response.artworkAsset?.url };
  } catch (err) {
    return releaseActionFailure(err, 'Failed to set artwork', {
      [Code.NotFound]: 'Release or file not found',
      [Code.PermissionDenied]: 'No permission to edit this release',
    });
  }
}

export async function deleteReleaseArtworkAction(releaseId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createReleaseClient();
    await client.deleteReleaseArtwork({ releaseId });
    return { success: true };
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to delete artwork');
  }
}

// === Metadata Operations ===
// These use the secure ReleaseService API (requires edit permission)

export async function setReleaseLabelsAction(
  releaseId: string,
  labels: { labelId: string; catalogNumber?: string; sortOrder: number }[],
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createReleaseClient();
    await client.setReleaseLabels({
      releaseId,
      labels: labels.map((l) => ({
        labelId: l.labelId,
        catalogNumber: l.catalogNumber,
        sortOrder: l.sortOrder,
      })),
    });
    return { success: true };
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to update labels');
  }
}

export async function setReleaseGenresAction(
  releaseId: string,
  genreIds: string[],
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createReleaseClient();
    await client.setReleaseGenres({
      releaseId,
      genreIds,
    });
    return { success: true };
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to update genres');
  }
}

export async function setReleaseArtistsAction(
  releaseId: string,
  artists: { artistId: string; sortOrder: number }[],
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createReleaseClient();
    await client.setReleaseArtists({
      releaseId,
      artists: artists.map((artist) => ({
        artistId: artist.artistId,
        sortOrder: artist.sortOrder,
      })),
    });
    return { success: true };
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to update artists');
  }
}

export async function setReleaseCategoriesAction(
  releaseId: string,
  categoryIds: string[],
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createReleaseClient();
    await client.setReleaseCategories({
      releaseId,
      categoryIds,
    });
    return { success: true };
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to update categories');
  }
}

export async function setReleaseStylesAction(
  releaseId: string,
  styleIds: string[],
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createReleaseClient();
    await client.setReleaseStyles({
      releaseId,
      styleIds,
    });
    return { success: true };
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to update styles');
  }
}

export async function setReleaseFormatsAction(
  releaseId: string,
  formats: { formatId: string; formatDescription?: string }[],
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createReleaseClient();
    await client.setReleaseFormats({
      releaseId,
      formats: formats.map((f) => ({
        formatId: f.formatId,
        formatDescription: f.formatDescription,
      })),
    });
    return { success: true };
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to update formats');
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
): Promise<{ success?: boolean; error?: string }> {
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
    });
    return { success: true };
  } catch (err) {
    return releaseEditorFailure(err, 'Failed to update credits');
  }
}
