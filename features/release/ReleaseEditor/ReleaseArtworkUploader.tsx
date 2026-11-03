'use client';
import { useReleaseEditorCanEdit } from './ReleaseEditorAccessContext';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import { deleteReleaseArtworkAction, setReleaseArtworkAction } from '@/lib/actions/release';
import { getUntrackedConfigurationWriteOrigin } from '@/lib/editor/editor-write-origin';
import { useUpload } from '@/lib/hooks/useUpload';
import { UploadType } from '@/lib/types/upload/model';
import { createClientLogger } from '@/lib/utils/client-logger';
import { ReleaseArtworkView } from './ReleaseArtworkView';

const logger = createClientLogger('ReleaseArtworkUploader');
interface ReleaseArtworkUploaderProps {
  releaseId: string;
  artworkUrl: string | null;
  inputId?: string;
  onArtworkChange: (url: string | null) => void;
}

export function ReleaseArtworkUploader({
  releaseId,
  artworkUrl,
  inputId,
  onArtworkChange,
}: ReleaseArtworkUploaderProps) {
  const canEdit = useReleaseEditorCanEdit();
  const tCommon = useTranslations('common');
  const t = useTranslations('releaseEditor.artwork');
  const [uploadProgress, setUploadProgress] = useState(0);

  const { upload, isUploading } = useUpload(UploadType.RELEASE_ARTWORK);
  const setArtwork = useMutation({
    mutationFn: (fileId: string) => {
      const editorOrigin = getUntrackedConfigurationWriteOrigin(`release:${releaseId}`);
      return setReleaseArtworkAction(releaseId, fileId, editorOrigin);
    },
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      if (result.url) {
        onArtworkChange(result.url);
      }
      notifications.show({
        message: tCommon('messages.itemUpdated', { item: t('label') }),
        tone: 'positive',
      });
    },
  });

  const removeArtwork = useMutation({
    mutationFn: () => {
      const editorOrigin = getUntrackedConfigurationWriteOrigin(`release:${releaseId}`);
      return deleteReleaseArtworkAction(releaseId, editorOrigin);
    },
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      onArtworkChange(null);
      notifications.show({
        message: tCommon('messages.itemRemoved', { item: t('label') }),
        tone: 'positive',
      });
    },
  });

  const handleUpload = async (croppedBlob: Blob) => {
    if (!canEdit) {
      return;
    }
    setUploadProgress(0);

    try {
      const { fileId } = await upload(croppedBlob, {
        entityId: releaseId,
        fileName: 'artwork',
        onProgress: (progress) => setUploadProgress(progress.percentage),
      });

      await setArtwork.mutateAsync(fileId);
    } catch (error) {
      logger.error('Upload error', {
        error: error instanceof Error ? error.message : String(error),
      });
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('messages.uploadImageFailed'),
        tone: 'danger',
      });
    } finally {
      setUploadProgress(0);
    }
  };

  const handleRemove = () => {
    if (!canEdit) {
      return;
    }
    removeArtwork.mutate();
  };

  return (
    <ReleaseArtworkView
      artworkUrl={artworkUrl}
      inputId={inputId}
      isUploading={isUploading || setArtwork.isPending}
      uploadProgress={uploadProgress}
      isRemoving={removeArtwork.isPending}
      onUpload={handleUpload}
      onRemove={handleRemove}
    />
  );
}
