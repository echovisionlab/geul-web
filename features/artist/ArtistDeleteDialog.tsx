'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import {
  ArtistDeleteDialogView,
  type ArtistDeletePreviewViewModel,
} from '@/features/admin/artist/ArtistDeleteDialogView';
import { deleteArtistAction, previewDeleteArtistAction } from '@/lib/actions/artist';

interface ArtistDeleteTarget {
  id: string;
  name: string;
}

interface ArtistDeleteDialogProps {
  artist: ArtistDeleteTarget | null;
  onClose: () => void;
  onDeleted: () => void;
  previewAction?: typeof previewDeleteArtistAction;
  deleteAction?: typeof deleteArtistAction;
}

export function ArtistDeleteDialog({
  artist,
  onClose,
  onDeleted,
  previewAction = previewDeleteArtistAction,
  deleteAction = deleteArtistAction,
}: ArtistDeleteDialogProps) {
  const tCommon = useTranslations('common');
  const [deleting, setDeleting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<ArtistDeletePreviewViewModel | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const loadPreview = useCallback((artistId: string) => previewAction(artistId), [previewAction]);

  useEffect(() => {
    if (!artist) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setPreview(null);
    setPreviewLoading(true);
    setPreviewError(null);
    void loadPreview(artist.id).then((result) => {
      if (cancelled) {
        return;
      }
      setPreview(result.data ?? null);
      setPreviewError(result.error ?? null);
      setPreviewLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [artist, loadPreview]);

  const handleDelete = async () => {
    if (!artist || !preview) {
      return;
    }

    setDeleting(true);
    try {
      const result = await deleteAction(artist.id, preview.revision);
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        setPreviewLoading(true);
        const refreshed = await loadPreview(artist.id);
        setPreview(refreshed.data ?? null);
        setPreviewError(refreshed.error ?? null);
        setPreviewLoading(false);
        return;
      }
      notifications.show({
        message: tCommon('messages.itemDeleted', { item: tCommon('entities.artist') }),
        color: 'red',
      });
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ArtistDeleteDialogView
      opened={Boolean(artist)}
      artistName={artist?.name ?? tCommon('entities.artist')}
      preview={preview}
      previewLoading={previewLoading}
      previewError={previewError}
      deleting={deleting}
      onClose={onClose}
      onConfirm={handleDelete}
      labels={{
        title: tCommon('actions.delete'),
        confirm: tCommon('actions.delete'),
        cancel: tCommon('actions.cancel'),
        close: tCommon('actions.close'),
        loading: tCommon('states.loading'),
        failed: tCommon('messages.failedToLoad'),
        confirmation: tCommon('messages.deleteNamedItemConfirm', { name: '{name}' }),
        relationSummary: tCommon('messages.relatedItemsWillBeUnlinked', { count: '{count}' }),
      }}
    />
  );
}
