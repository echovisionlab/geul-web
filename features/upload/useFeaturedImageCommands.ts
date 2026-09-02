'use client';

import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import type { UploadType } from '@/lib/types/upload/model';
import { useImageAssetUpload } from './useImageAssetUpload';

interface FeaturedImageResult {
  error?: string;
  imageUrl?: string | null;
  ogGenerationRunId?: string;
}

interface Options {
  entityId: string;
  uploadType: UploadType;
  setImage: (fileId: string, imageUrl: string | null) => boolean;
  clearImage: () => boolean;
  setImageAction: (fileId: string) => Promise<FeaturedImageResult>;
  removeImageAction: () => Promise<FeaturedImageResult>;
  onOgGenerationRequested?: (runId: string) => void;
  enabled?: boolean;
}

export function useFeaturedImageCommands({
  entityId,
  uploadType,
  setImage,
  clearImage,
  setImageAction,
  removeImageAction,
  onOgGenerationRequested,
  enabled = true,
}: Options) {
  const t = useTranslations('common.notifications');
  const assertEnabled = () => {
    if (!enabled) {
      throw new Error(t('updateFailed'));
    }
  };
  const notifyGeneration = (result: FeaturedImageResult) => {
    if (result.ogGenerationRunId) {
      onOgGenerationRequested?.(result.ogGenerationRunId);
    }
  };

  const setMutation = useMutation({
    mutationFn: async (fileId: string) => {
      assertEnabled();
      return setImageAction(fileId);
    },
    onSuccess: (result, fileId) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      if (!setImage(fileId, result.imageUrl ?? null)) {
        notifications.show({ message: t('updateFailed'), color: 'red' });
        return;
      }
      notifyGeneration(result);
      notifications.show({ message: t('featuredImageUpdated'), color: 'green' });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      assertEnabled();
      return removeImageAction();
    },
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      if (!clearImage()) {
        notifications.show({ message: t('updateFailed'), color: 'red' });
        return;
      }
      notifyGeneration(result);
      notifications.show({ message: t('featuredImageRemoved'), color: 'yellow' });
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : t('updateFailed'),
        color: 'red',
      });
    },
  });

  const upload = useImageAssetUpload({
    uploadType,
    entityId,
    fileName: 'featured',
    onUploaded: setMutation.mutateAsync,
    uploadFailedMessage: t('uploadFailed'),
    enabled,
    disabledMessage: t('updateFailed'),
  });

  return {
    handleUpload: upload.handleUpload,
    uploadProgress: upload.uploadProgress,
    isUploading: upload.isUploading,
    handleRemove: () => removeMutation.mutate(),
    isRemoving: removeMutation.isPending,
  };
}
