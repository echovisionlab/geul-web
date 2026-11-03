'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
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
  const target = useMemo(() => ({}), [entityId, enabled]);
  const currentTarget = useRef<object | null>(target);
  currentTarget.current = target;
  useEffect(() => {
    currentTarget.current = target;
    return () => {
      if (currentTarget.current === target) {
        currentTarget.current = null;
      }
    };
  }, [target]);
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
    mutationFn: async (request: { fileId: string; target: object }) => {
      assertEnabled();
      return setImageAction(request.fileId);
    },
    onSuccess: (result, request) => {
      if (currentTarget.current !== request.target) {
        return;
      }
      const fileId = request.fileId;
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      if (!setImage(fileId, result.imageUrl ?? null)) {
        notifications.show({ message: t('updateFailed'), tone: 'danger' });
        return;
      }
      notifyGeneration(result);
      notifications.show({ message: t('featuredImageUpdated'), tone: 'positive' });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (_request: { target: object }) => {
      assertEnabled();
      return removeImageAction();
    },
    onSuccess: (result, request) => {
      if (currentTarget.current !== request.target) {
        return;
      }
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      if (!clearImage()) {
        notifications.show({ message: t('updateFailed'), tone: 'danger' });
        return;
      }
      notifyGeneration(result);
      notifications.show({ message: t('featuredImageRemoved'), tone: 'warning' });
    },
    onError: (error, request) => {
      if (currentTarget.current !== request.target) {
        return;
      }
      notifications.show({
        message: error instanceof Error ? error.message : t('updateFailed'),
        tone: 'danger',
      });
    },
  });

  const upload = useImageAssetUpload({
    uploadType,
    entityId,
    fileName: 'featured',
    onUploaded: (fileId) => setMutation.mutateAsync({ fileId, target }),
    uploadFailedMessage: t('uploadFailed'),
    enabled,
    disabledMessage: t('updateFailed'),
  });

  return {
    handleUpload: upload.handleUpload,
    uploadProgress: upload.uploadProgress,
    isUploading: upload.isUploading,
    handleRemove: () => removeMutation.mutateAsync({ target }).catch(() => {}),
    isRemoving: removeMutation.isPending && removeMutation.variables?.target === target,
  };
}
