'use client';

import { ImageUploadCropController } from '@/features/upload/ImageUploadCropController';
import { useFeaturedImageCommands } from '@/features/upload/useFeaturedImageCommands';
import { removeWorkFeaturedImageAction, setWorkFeaturedImageAction } from '@/lib/actions/work';
import { getUploadSelectionMimeTypes, UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { useWorkMeta } from '@/lib/contexts/WorkMetaContext';
import { UploadType } from '@/lib/types/upload/model';

const workFeaturedImageConfig = UPLOAD_CONFIGS[UploadType.WORK_FEATURED_IMAGE];

interface WorkFeaturedImageUploaderProps {
  workId: string;
  idPrefix?: string;
  canEdit: boolean;
  onOgGenerationRequested?: (runId: string) => void;
}

export function WorkFeaturedImageUploader({
  workId,
  idPrefix,
  canEdit,
  onOgGenerationRequested,
}: WorkFeaturedImageUploaderProps) {
  const { featuredImageUrl, setFeaturedImage, isConnected, isSynced } = useWorkMeta();
  const isCollaborationReady = isConnected && isSynced;
  const commands = useFeaturedImageCommands({
    uploadType: UploadType.WORK_FEATURED_IMAGE,
    entityId: workId,
    setImage: setFeaturedImage,
    clearImage: () => setFeaturedImage(null, null),
    setImageAction: (fileId) => setWorkFeaturedImageAction(workId, fileId),
    removeImageAction: () => removeWorkFeaturedImageAction(workId),
    onOgGenerationRequested,
    enabled: isCollaborationReady,
  });

  return (
    <ImageUploadCropController
      imageUrl={featuredImageUrl}
      idPrefix={idPrefix}
      canEdit={canEdit && isCollaborationReady}
      isUploading={commands.isUploading}
      uploadProgress={commands.uploadProgress}
      isRemoving={commands.isRemoving}
      onUpload={commands.handleUpload}
      onRemove={commands.handleRemove}
      sizes="(min-width: 62em) 50vw, 100vw"
      acceptMimeTypes={getUploadSelectionMimeTypes(UploadType.WORK_FEATURED_IMAGE)}
      maxSize={workFeaturedImageConfig.maxSize}
    />
  );
}
