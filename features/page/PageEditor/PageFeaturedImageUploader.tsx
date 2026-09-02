'use client';

import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { ImageUploadCropController } from '@/features/upload/ImageUploadCropController';
import { useImageAssetUpload } from '@/features/upload/useImageAssetUpload';
import { removePageFeaturedImageAction, setPageFeaturedImageAction } from '@/lib/actions/page';
import { getUploadSelectionMimeTypes, UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { UploadType } from '@/lib/types/upload/model';

const featuredImageConfig = UPLOAD_CONFIGS[UploadType.FEATURED_IMAGE];

interface PageFeaturedImageUploaderProps {
  pageId: string;
  imageUrl: string | null;
  onImageUrlChange: (imageUrl: string | null) => void;
  idPrefix?: string;
  canEdit: boolean;
  onOgGenerationRequested?: (runId: string) => void;
}

export function PageFeaturedImageUploader({
  pageId,
  imageUrl,
  onImageUrlChange,
  idPrefix,
  canEdit,
  onOgGenerationRequested,
}: PageFeaturedImageUploaderProps) {
  const tCommonNotifications = useTranslations('common.notifications');
  const setFeaturedImage = useMutation({
    mutationFn: (fileId: string) => setPageFeaturedImageAction(pageId, fileId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      onImageUrlChange(result.imageUrl ?? null);
      if (result.ogGenerationRunId) {
        onOgGenerationRequested?.(result.ogGenerationRunId);
      }
      notifications.show({ message: tCommonNotifications('featuredImageUpdated'), color: 'green' });
    },
  });

  const removeFeaturedImage = useMutation({
    mutationFn: () => removePageFeaturedImageAction(pageId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      onImageUrlChange(null);
      if (result.ogGenerationRunId) {
        onOgGenerationRequested?.(result.ogGenerationRunId);
      }
      notifications.show({
        message: tCommonNotifications('featuredImageRemoved'),
        color: 'yellow',
      });
    },
  });

  const { handleUpload, isUploading, uploadProgress } = useImageAssetUpload({
    uploadType: UploadType.FEATURED_IMAGE,
    entityId: pageId,
    entityType: TranscodeEntityType.PAGE,
    fileName: 'featured',
    onUploaded: setFeaturedImage.mutateAsync,
    uploadFailedMessage: tCommonNotifications('uploadFailed'),
  });

  const handleRemove = () => {
    removeFeaturedImage.mutate();
  };

  return (
    <ImageUploadCropController
      imageUrl={imageUrl}
      idPrefix={idPrefix}
      canEdit={canEdit}
      isUploading={isUploading}
      uploadProgress={uploadProgress}
      isRemoving={removeFeaturedImage.isPending}
      onUpload={handleUpload}
      onRemove={handleRemove}
      acceptMimeTypes={getUploadSelectionMimeTypes(UploadType.FEATURED_IMAGE)}
      maxSize={featuredImageConfig.maxSize}
    />
  );
}
