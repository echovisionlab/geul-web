'use server';

import { isConnectErrorCode } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { timestampDate, type Timestamp } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { createTrackClient } from '@/lib/api/server-client';
import type { ReleaseTrackItem } from '@/lib/collab/schemas/release-fields.schema';
import { mapTrackCreditInput, type TrackCreditInput } from './track-credit-mutation';

interface TrackSelect {
  id: string;
  release_id: string;
  track_number: number;
  title: string;
  duration_seconds: number | null;
  audio_original_file_id: string | null;
  processing_status: string | null;
  lyrics: string | null;
  created_at: Date;
}

function mapTrack(t: {
  id: string;
  releaseId: string;
  trackNumber: number;
  title: string;
  durationSeconds?: number;
  audioOriginalFileId?: string;
  processingStatus?: string;
  lyrics?: string;
  createdAt?: Timestamp;
}): TrackSelect {
  return {
    id: t.id,
    release_id: t.releaseId,
    track_number: t.trackNumber,
    title: t.title,
    duration_seconds: t.durationSeconds ?? null,
    audio_original_file_id: t.audioOriginalFileId ?? null,
    processing_status: t.processingStatus ?? null,
    lyrics: t.lyrics ?? null,
    created_at: t.createdAt ? timestampDate(t.createdAt) : new Date(),
  };
}

export async function createTrackAction(data: {
  release_id: string;
  track_number: number;
  title: string;
  duration_seconds?: number;
  lyrics?: string;
}): Promise<{ data?: TrackSelect; error?: string }> {
  try {
    const client = await createTrackClient();
    const result = await client.createTrack({
      releaseId: data.release_id,
      trackNumber: data.track_number,
      title: data.title,
      durationSeconds: data.duration_seconds,
      lyrics: data.lyrics,
    });
    revalidatePath(`/releases/${data.release_id}`);
    return { data: mapTrack(result) };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create track' };
  }
}

export async function listTracksByReleaseAction(releaseId: string): Promise<ReleaseTrackItem[]> {
  try {
    const client = await createTrackClient();
    const response = await client.listTracksByRelease({ releaseId });
    return (response.tracks ?? []).map((entry) => ({
      id: entry.track?.id ?? '',
      track_number: entry.track?.trackNumber ?? 0,
      title: entry.track?.title ?? '',
      duration_seconds: entry.track?.durationSeconds ?? null,
      audio_attached: Boolean(entry.track?.audioOriginalFileId),
      audio_original_file_id: entry.track?.audioOriginalFileId ?? null,
      processing_status: entry.track?.processingStatus ?? null,
      credits: (entry.credits ?? []).map((credit) => ({
        id: credit.id,
        credit_type: credit.creditType as ReleaseTrackItem['credits'][number]['credit_type'],
        artist_id: credit.artistId ?? null,
        artist_name: credit.artistName ?? null,
        artist_slug: credit.artistSlug ?? null,
        member_id: credit.memberId ?? null,
        member_name: credit.member?.nickname ?? null,
        credited_name: credit.creditedName ?? null,
        credit_role: credit.creditRole ?? null,
        sort_order: credit.sortOrder,
      })),
    }));
  } catch {
    return [];
  }
}

export async function updateTrackAction(
  id: string,
  data: {
    track_number?: number;
    title?: string;
    duration_seconds?: number | null;
    processing_status?: string | null;
    lyrics?: string | null;
  },
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createTrackClient();
    await client.updateTrack({
      id,
      trackNumber: data.track_number,
      title: data.title,
      durationSeconds: data.duration_seconds ?? undefined,
      clearDuration: data.duration_seconds === null,
      processingStatus: data.processing_status ?? undefined,
      lyrics: data.lyrics ?? undefined,
      clearLyrics: data.lyrics === null,
    });
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Track not found' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update track' };
  }
}

export async function deleteTrackAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createTrackClient();
    await client.deleteTrack({ id });
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Track not found' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete track' };
  }
}

export async function setTrackCreditsAction(
  trackId: string,
  credits: TrackCreditInput[],
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createTrackClient();
    await client.setTrackCredits({
      trackId,
      credits: credits.map(mapTrackCreditInput),
    });
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Track not found' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to set track credits' };
  }
}

export async function reorderTracksAction(trackIds: string[]): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createTrackClient();
    await client.reorderTracks({ trackIds });
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to reorder tracks' };
  }
}
