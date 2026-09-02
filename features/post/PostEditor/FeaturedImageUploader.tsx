'use client';

import { ImageUploadCropController } from '@/features/upload/ImageUploadCropController';
import { useFeaturedImageCommands } from '@/features/upload/useFeaturedImageCommands';
import { removePostFeaturedImageAction, setPostFeaturedImageAction } from '@/lib/actions/post';
import { getUploadSelectionMimeTypes, UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { usePostMeta } from '@/lib/contexts/PostMetaContext';
import { UploadType } from '@/lib/types/upload/model';

const featuredImageConfig = UPLOAD_CONFIGS[UploadType.FEATURED_IMAGE];

interface FeaturedImageUploaderProps {
  postId: string;
  idPrefix?: string;
  canEdit: boolean;
  onOgGenerationRequested?: (runId: string) => void;
}

export function FeaturedImageUploader({
  postId,
  idPrefix,
  canEdit,
  onOgGenerationRequested,
}: FeaturedImageUploaderProps) {
  const { featuredImageUrl, setFeaturedImage } = usePostMeta();
  const commands = useFeaturedImageCommands({
    uploadType: UploadType.FEATURED_IMAGE,
    entityId: postId,
    setImage: setFeaturedImage,
    clearImage: () => setFeaturedImage(null, null),
    setImageAction: (fileId) => setPostFeaturedImageAction(postId, fileId),
    removeImageAction: () => removePostFeaturedImageAction(postId),
    onOgGenerationRequested,
  });

  return (
    <ImageUploadCropController
      imageUrl={featuredImageUrl}
      idPrefix={idPrefix}
      canEdit={canEdit}
      isUploading={commands.isUploading}
      uploadProgress={commands.uploadProgress}
      isRemoving={commands.isRemoving}
      onUpload={commands.handleUpload}
      onRemove={commands.handleRemove}
      acceptMimeTypes={getUploadSelectionMimeTypes(UploadType.FEATURED_IMAGE)}
      maxSize={featuredImageConfig.maxSize}
    />
  );
}
