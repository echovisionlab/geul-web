'use client';

import { useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import { reorderTracksAction } from '@/lib/actions/track';
import type { ReleaseTrackItem } from '@/lib/collab/schemas/release-fields.schema';
import { requireActionSuccess } from '@/lib/editor/require-action-success';
import { getUntrackedConfigurationWriteOrigin } from '@/lib/editor/editor-write-origin';
import { publishEditorEntityChange } from '@/lib/editor/editor-entity-changes';

export function restoreTrackOrder(tracks: ReleaseTrackItem[], savedOrder: string[]): ReleaseTrackItem[] {
  const positions = new Map(savedOrder.map((id, index) => [id, index]));
  const position = (track: ReleaseTrackItem) => positions.get(track.id) ?? tracks.length;
  // Restore ordering only. Keep current titles, uploads, additions, and deletions.
  return [...tracks]
    .sort((a, b) => position(a) - position(b))
    .map((track, index) => ({ ...track, track_number: index + 1 }));
}

export function useTrackOrderSave({
  releaseId,
  tracks,
  onTracksChange,
  onMutationStart,
  onMutationSettled,
}: {
  releaseId: string;
  tracks: ReleaseTrackItem[];
  onTracksChange: (tracks: ReleaseTrackItem[]) => void;
  onMutationStart?: () => string | void;
  onMutationSettled?: (succeeded: boolean) => void;
}) {
  const t = useTranslations('common.notifications');
  const confirmedOrder = useRef(tracks.map((track) => track.id));
  const latestRequest = useRef(0);
  const save = useMutation({
    scope: { id: `release-track-order:${releaseId}` },
    mutationFn: async (request: { trackIds: string[]; version: number }) => {
      const editorOrigin = onMutationStart?.() || getUntrackedConfigurationWriteOrigin(`release:${releaseId}`);
      const result = await requireActionSuccess(reorderTracksAction(request.trackIds, editorOrigin));
      publishEditorEntityChange(`release:${releaseId}`, editorOrigin);
      return result;
    },
    onSettled: (_result, error) => onMutationSettled?.(!error),
    onSuccess: (_result, request) => {
      confirmedOrder.current = request.trackIds;
    },
    onError: (error, request) => {
      if (request.version === latestRequest.current) {
        onTracksChange(restoreTrackOrder(tracks, confirmedOrder.current));
      }
      notifications.show({ message: error instanceof Error ? error.message : t('saveFailed'), tone: 'danger' });
    },
  });
  useEffect(() => {
    if (!save.isPending) {
      confirmedOrder.current = tracks.map((track) => track.id);
    }
  }, [save.isPending, tracks]);
  return (next: ReleaseTrackItem[]) => {
    onTracksChange(next);
    save.mutate({ trackIds: next.map((track) => track.id), version: ++latestRequest.current });
  };
}
