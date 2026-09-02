'use client';

import { useTranslations } from 'next-intl';
import { ImageUploadCropController } from '@/features/upload/ImageUploadCropController';
import { getUploadSelectionMimeTypes, UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { UploadType } from '@/lib/types/upload/model';

const releaseArtworkConfig = UPLOAD_CONFIGS[UploadType.RELEASE_ARTWORK];

interface ReleaseArtworkViewProps {
  artworkUrl: string | null;
  inputId?: string;
  isUploading?: boolean;
  uploadProgress?: number;
  isRemoving?: boolean;
  onUpload: (blob: Blob) => void;
  onRemove: () => void;
}

export function ReleaseArtworkView({
  artworkUrl,
  inputId,
  isUploading = false,
  uploadProgress = 0,
  isRemoving = false,
  onUpload,
  onRemove,
}: ReleaseArtworkViewProps) {
  const t = useTranslations('releaseEditor.artwork');

  return (
    <ImageUploadCropController
      imageUrl={artworkUrl}
      idPrefix={inputId}
      canEdit
      isUploading={isUploading}
      uploadProgress={uploadProgress}
      isRemoving={isRemoving}
      onUpload={onUpload}
      onRemove={onRemove}
      aspectRatio={1}
      previewWidth={180}
      previewMaxWidth="min(100%, 180px)"
      previewMinHeight={180}
      label={t('label')}
      acceptMimeTypes={getUploadSelectionMimeTypes(UploadType.RELEASE_ARTWORK)}
      maxSize={releaseArtworkConfig.maxSize}
    />
  );
}
