'use server';

import { actionFailure, type ActionResult } from '@/lib/actions/action-result';
import { runAction } from '@/lib/actions/run-action';
import { queryResult, type QueryResult, unwrapQueryResult } from '@/lib/api/query-result';

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

export async function createTrackAction(
  data: {
    release_id: string;
    track_number: number;
    title: string;
    duration_seconds?: number;
    lyrics?: string;
  },
  editorOrigin?: string,
): Promise<ActionResult<{ data: TrackSelect }>> {
  return runAction(
    'track-actions',
    'createTrackAction',
    async () => {
      const client = await createTrackClient(editorOrigin);
      const result = await client.createTrack({
        releaseId: data.release_id,
        trackNumber: data.track_number,
        title: data.title,
        durationSeconds: data.duration_seconds,
        lyrics: data.lyrics,
      });
      revalidatePath(`/releases/${data.release_id}`);
      return { data: mapTrack(result) };
    },
    { fallback: 'Failed to create track' },
  );
}

export async function listTracksByReleaseAction(releaseId: string): Promise<ReleaseTrackItem[]> {
  return (await getReleaseTrackSnapshotAction(releaseId).then(unwrapQueryResult)) ?? [];
}

/** Returns an explicit, safe failure result on transport or authorization errors. */
export async function getReleaseTrackSnapshotAction(
  releaseId: string,
): Promise<QueryResult<ReleaseTrackItem[] | null>> {
  return queryResult(async () => {
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
  });
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
  editorOrigin?: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'track-actions',
    'updateTrackAction',
    async () => {
      const client = await createTrackClient(editorOrigin);
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
      return { success: true as const };
    },
    { fallback: 'Failed to update track', messages: { [Code.NotFound]: 'Track not found' } },
  );
}

export async function deleteTrackAction(id: string, editorOrigin?: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'track-actions',
    'deleteTrackAction',
    async () => {
      const client = await createTrackClient(editorOrigin);
      await client.deleteTrack({ id });
      return { success: true as const };
    },
    { fallback: 'Failed to delete track', messages: { [Code.NotFound]: 'Track not found' } },
  );
}

export async function setTrackCreditsAction(
  trackId: string,
  credits: TrackCreditInput[],
  observedCredits: TrackCreditInput[],
  editorOrigin?: string,
): Promise<ActionResult<{ success: true }>> {
  if (!Array.isArray(observedCredits)) {
    return actionFailure('An observed credit snapshot is required', Code.InvalidArgument);
  }
  return runAction(
    'track-actions',
    'setTrackCreditsAction',
    async () => {
      const client = await createTrackClient(editorOrigin);
      await client.setTrackCredits({
        trackId,
        credits: credits.map(mapTrackCreditInput),
        observed: { credits: observedCredits.map(mapTrackCreditInput) },
      });
      return { success: true as const };
    },
    { fallback: 'Failed to set track credits', messages: { [Code.NotFound]: 'Track not found' } },
  );
}

export async function reorderTracksAction(
  trackIds: string[],
  editorOrigin?: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'track-actions',
    'reorderTracksAction',
    async () => {
      const client = await createTrackClient(editorOrigin);
      await client.reorderTracks({ trackIds });
      return { success: true as const };
    },
    { fallback: 'Failed to reorder tracks' },
  );
}
