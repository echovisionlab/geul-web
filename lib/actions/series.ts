'use server';

import { isConnectError } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { Code } from '@connectrpc/connect';
import { regenerateOgImageAction as requestOgImageRegeneration } from '@/lib/actions/og-generation';
import { createCommittedMutationRevalidator } from '@/lib/actions/revalidate-after-commit';
import { createSeriesClient } from '@/lib/api/server-client';
import type { SeriesStatus } from '@/lib/types/series/model';
import { toApiSeriesStatus } from '@/lib/types/series/status';

const revalidateSeriesAfterCommit = createCommittedMutationRevalidator('series-actions', 'series');

export type SeriesPostMutationError = 'post_permission_revoked' | 'series_unavailable' | 'failed';

export type SeriesPostMutationResult =
  { success: true; error?: never } | { success?: never; error: SeriesPostMutationError };

function mapSeriesPostMutationError(error: unknown): SeriesPostMutationResult {
  if (isConnectError(error)) {
    if (error.code === Code.PermissionDenied) {
      return { error: 'post_permission_revoked' };
    }
    if (error.code === Code.NotFound) {
      return { error: 'series_unavailable' };
    }
  }
  return { error: 'failed' };
}

export async function createSeriesAction(data: {
  title: string;
  description?: string;
}): Promise<{ data?: { id: string }; error?: string }> {
  try {
    const client = await createSeriesClient();
    const series = await client.createSeries({
      title: data.title,
      description: data.description,
    });
    revalidatePath('/admin/series');
    revalidatePath('/my/series');
    return { data: { id: series.id } };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create series' };
  }
}

export async function deleteSeriesAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createSeriesClient();
    await client.deleteSeries({ id });
    revalidateSeriesAfterCommit('/admin/series');
    revalidateSeriesAfterCommit('/my/series');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete series' };
  }
}

export async function updateSeriesAction(
  id: string,
  data: {
    title?: string;
    slug?: string;
    description?: string | null;
    status?: SeriesStatus;
  },
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createSeriesClient();
    await client.updateSeries({
      id,
      title: data.title,
      slug: data.slug,
      description: data.description ?? undefined,
      status: toApiSeriesStatus(data.status),
    });
    revalidateSeriesAfterCommit('/admin/series');
    revalidateSeriesAfterCommit('/my/series');
    revalidateSeriesAfterCommit(`/admin/series/${id}`);
    revalidateSeriesAfterCommit(`/my/series/${id}`);
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update series' };
  }
}

export async function addSeriesManagerAction(
  seriesId: string,
  memberId: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createSeriesClient();
    await client.addSeriesManager({ seriesId, memberId });
    revalidatePath('/admin/series');
    revalidatePath(`/admin/series/${seriesId}`);
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to add manager' };
  }
}

export async function removeSeriesManagerAction(
  seriesId: string,
  memberId: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createSeriesClient();
    await client.removeSeriesManager({ seriesId, memberId });
    revalidatePath('/admin/series');
    revalidatePath(`/admin/series/${seriesId}`);
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to remove manager' };
  }
}

export async function assignPostToSeriesAction(seriesId: string, postId: string): Promise<SeriesPostMutationResult> {
  try {
    const client = await createSeriesClient();
    await client.assignPostToSeries({ seriesId, postId });
    revalidatePath(`/admin/series/${seriesId}`);
    revalidatePath(`/my/series/${seriesId}`);
    return { success: true };
  } catch (err) {
    return mapSeriesPostMutationError(err);
  }
}

export async function unassignPostFromSeriesAction(
  seriesId: string,
  postId: string,
): Promise<SeriesPostMutationResult> {
  try {
    const client = await createSeriesClient();
    await client.unassignPostFromSeries({ seriesId, postId });
    revalidatePath(`/admin/series/${seriesId}`);
    revalidatePath(`/my/series/${seriesId}`);
    return { success: true };
  } catch (err) {
    return mapSeriesPostMutationError(err);
  }
}

export async function reorderSeriesPostsAction(seriesId: string, postIds: string[]): Promise<SeriesPostMutationResult> {
  try {
    const client = await createSeriesClient();
    await client.reorderSeriesPosts({ seriesId, postIds });
    revalidatePath(`/admin/series/${seriesId}`);
    revalidatePath(`/my/series/${seriesId}`);
    return { success: true };
  } catch (err) {
    return mapSeriesPostMutationError(err);
  }
}

export async function setSeriesFeaturedImageAction(
  seriesId: string,
  fileId: string,
): Promise<{ imageUrl?: string; ogGenerationRunId?: string; error?: string }> {
  try {
    const client = await createSeriesClient();
    const result = await client.setSeriesFeaturedImage({ seriesId, fileId });
    revalidateSeriesAfterCommit(`/admin/series/${seriesId}`);
    revalidateSeriesAfterCommit(`/my/series/${seriesId}`);
    const response = { imageUrl: result.imageAsset?.url };
    return result.ogGenerationRunId ? { ...response, ogGenerationRunId: result.ogGenerationRunId } : response;
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to set series featured image' };
  }
}

export async function removeSeriesFeaturedImageAction(
  seriesId: string,
): Promise<{ success?: boolean; ogGenerationRunId?: string; error?: string }> {
  try {
    const client = await createSeriesClient();
    const result = await client.deleteSeriesFeaturedImage({ seriesId });
    revalidateSeriesAfterCommit(`/admin/series/${seriesId}`);
    revalidateSeriesAfterCommit(`/my/series/${seriesId}`);
    return result.ogGenerationRunId
      ? { success: true, ogGenerationRunId: result.ogGenerationRunId }
      : { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return {
      error: err instanceof Error ? err.message : 'Failed to remove series featured image',
    };
  }
}

export async function regenerateSeriesOgImageAction(
  seriesId: string,
  locale: string,
): Promise<{ success?: boolean; runId?: string; generationId?: string; error?: string }> {
  const result = await requestOgImageRegeneration({
    entityType: 'series',
    entityId: seriesId,
    selection: { type: 'locale', locale },
  });
  if (result.error) {
    return { error: result.error };
  }
  return { success: true, runId: result.runId, generationId: result.generationIds?.[0] };
}
