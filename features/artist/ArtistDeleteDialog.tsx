'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import { PageLoader } from '@/features/site/PageLoader';
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
  const targetRef = useRef(artist?.id);
  targetRef.current = artist?.id;
  const requestRef = useRef(0);
  const tCommon = useTranslations('common');
  const [deleting, setDeleting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewArtistId, setPreviewArtistId] = useState<string | undefined>();
  const previewMatchesTarget = previewArtistId === artist?.id;
  const [preview, setPreview] = useState<ArtistDeletePreviewViewModel | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const loadPreview = useCallback((artistId: string) => previewAction(artistId), [previewAction]);

  useEffect(() => {
    const request = ++requestRef.current;
    setPreviewArtistId(artist?.id);
    setDeleting(false);
    if (!artist) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    const isCurrent = () => requestRef.current === request && targetRef.current === artist.id;
    setPreview(null);
    setPreviewLoading(true);
    setPreviewError(null);
    void loadPreview(artist.id)
      .then((result) => {
        if (!isCurrent()) {
          return;
        }
        setPreview(result.data ?? null);
        setPreviewError(result.error ?? null);
        setPreviewLoading(false);
      })
      .catch(() => {
        if (isCurrent()) {
          setPreviewError(tCommon('messages.failedToLoad'));
          setPreviewLoading(false);
        }
      });
    return () => {
      requestRef.current++;
    };
  }, [artist?.id, loadPreview, tCommon]);

  const handleDelete = async () => {
    if (!artist || !preview || !previewMatchesTarget) {
      return;
    }

    const request = requestRef.current;
    const isCurrent = () => requestRef.current === request && targetRef.current === artist.id;
    setDeleting(true);
    try {
      const result = await deleteAction(artist.id, preview.revision);
      if (!isCurrent()) {
        return;
      }
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        setPreviewLoading(true);
        const refreshed = await loadPreview(artist.id);
        if (!isCurrent()) {
          return;
        }
        setPreview(refreshed.data ?? null);
        setPreviewError(refreshed.error ?? null);
        setPreviewLoading(false);
        return;
      }
      notifications.show({
        message: tCommon('messages.itemDeleted', { item: tCommon('entities.artist') }),
        tone: 'positive',
      });
      onDeleted();
    } catch {
      if (isCurrent()) {
        setPreviewError(tCommon('messages.failedToLoad'));
        setPreviewLoading(false);
      }
    } finally {
      if (isCurrent()) {
        setDeleting(false);
      }
    }
  };

  return (
    <ArtistDeleteDialogView
      opened={Boolean(artist)}
      artistName={artist?.name ?? tCommon('entities.artist')}
      preview={previewMatchesTarget ? preview : null}
      previewLoading={!previewMatchesTarget || previewLoading}
      loadingSurface={<PageLoader placement="flow" message={tCommon('states.loading')} />}
      previewError={previewMatchesTarget ? previewError : null}
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
