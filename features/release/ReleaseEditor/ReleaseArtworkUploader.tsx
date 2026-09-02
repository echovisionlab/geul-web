'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { deleteReleaseArtworkAction, setReleaseArtworkAction } from '@/lib/actions/release';
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
  const tCommon = useTranslations('common');
  const t = useTranslations('releaseEditor.artwork');
  const [uploadProgress, setUploadProgress] = useState(0);

  const { upload, isUploading } = useUpload(UploadType.RELEASE_ARTWORK);
  const setArtwork = useMutation({
    mutationFn: (fileId: string) => setReleaseArtworkAction(releaseId, fileId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      if (result.url) {
        onArtworkChange(result.url);
      }
      notifications.show({
        message: tCommon('messages.itemUpdated', { item: t('label') }),
        color: 'green',
      });
    },
  });

  const removeArtwork = useMutation({
    mutationFn: () => deleteReleaseArtworkAction(releaseId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      onArtworkChange(null);
      notifications.show({
        message: tCommon('messages.itemRemoved', { item: t('label') }),
        color: 'yellow',
      });
    },
  });

  const handleUpload = async (croppedBlob: Blob) => {
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
        color: 'red',
      });
    } finally {
      setUploadProgress(0);
    }
  };

  const handleRemove = () => {
    removeArtwork.mutate();
  };

  return (
    <ReleaseArtworkView
      artworkUrl={artworkUrl}
      inputId={inputId}
      isUploading={isUploading}
      uploadProgress={uploadProgress}
      isRemoving={removeArtwork.isPending}
      onUpload={handleUpload}
      onRemove={handleRemove}
    />
  );
}
