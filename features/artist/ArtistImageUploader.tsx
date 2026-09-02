'use client';

import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { deleteArtistAvatarAction, setArtistImageAction } from '@/lib/actions/artist';
import { useUpload } from '@/lib/hooks/useUpload';
import { UploadType } from '@/lib/types/upload/model';
import { ArtistImageCropper } from './ArtistEditor/ArtistImageCropper';

export interface ArtistImageUploaderProps {
  /** Artist ID to upload image for */
  artistId: string;
  /** Current image URL */
  currentImage: string | null | undefined;
  /** Artist's display name */
  artistName?: string | null;
  /** Deterministic file input id for testing */
  inputId?: string;
  /** Image display size */
  size?: number;
  /** Label text */
  label?: string;
  /** Called after successful upload or delete with the new URL */
  onImageChange?: (url: string | null) => void;
  /** Gallery owner callback. When present, the caller persists the File relation. */
  onFileUploaded?: (file: { fileId: string; url: string }) => Promise<void> | void;
  /** Gallery owner callback. When present, the caller persists removal. */
  onDeleteRequested?: () => Promise<void> | void;
}

/**
 * Feature wrapper for ArtistImageCropper that handles upload logic.
 *
 * Uses the unified upload system:
 * 1. Upload file to generic file table via useUpload hook
 * 2. Link file to artist via setImage mutation
 *
 * @example
 * ```tsx
 * <ArtistImageUploader
 *   artistId={artist.id}
 *   currentImage={artist.images[0]?.url ?? null}
 *   artistName={artist.name}
 *   onFileUploaded={({ fileId }) => appendImage(fileId)}
 * />
 * ```
 */
export function ArtistImageUploader({
  artistId,
  currentImage,
  artistName,
  inputId,
  size,
  label,
  onImageChange,
  onFileUploaded,
  onDeleteRequested,
}: ArtistImageUploaderProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  // Unified upload hook for file storage
  const { upload } = useUpload(UploadType.ARTIST_IMAGE);

  // Mutations for linking file to artist and deletion
  const setImage = useMutation({
    mutationFn: (data: { artistId: string; fileId: string }) => setArtistImageAction(data.artistId, data.fileId),
  });

  const deleteAvatar = useMutation({
    mutationFn: (data: { artistId: string }) => deleteArtistAvatarAction(data.artistId),
  });

  const handleUpload = useCallback(
    async (data: Uint8Array<ArrayBuffer>, mimeType: string): Promise<{ url: string }> => {
      // Convert Uint8Array to Blob for upload
      const blob = new Blob([data], { type: mimeType });

      // Upload to file table
      setUploadProgress(0);

      try {
        const { fileId, url } = await upload(blob, {
          entityId: artistId,
          fileName: 'image',
          onProgress: (progress) => setUploadProgress(progress.percentage),
        });

        // Link file to artist
        if (onFileUploaded) {
          await onFileUploaded({ fileId, url });
        } else {
          const result = await setImage.mutateAsync({ artistId, fileId });
          if (result.error) {
            notifications.show({ message: result.error, color: 'red' });
            throw new Error(result.error);
          }
        }

        return { url };
      } finally {
        setUploadProgress(0);
      }
    },
    [artistId, onFileUploaded, upload, setImage],
  );

  const handleDelete = useCallback(async () => {
    if (onDeleteRequested) {
      await onDeleteRequested();
      return;
    }
    const result = await deleteAvatar.mutateAsync({ artistId });
    if (result.error) {
      notifications.show({ message: result.error, color: 'red' });
      throw new Error(result.error);
    }
    return result;
  }, [artistId, deleteAvatar, onDeleteRequested]);

  const handleImageChange = useCallback(
    async (url: string | null) => {
      onImageChange?.(url);
    },
    [onImageChange],
  );

  return (
    <ArtistImageCropper
      currentImage={currentImage}
      artistName={artistName}
      inputId={inputId}
      size={size}
      label={label}
      uploadProgress={uploadProgress}
      onUpload={handleUpload}
      onDelete={handleDelete}
      onImageChange={handleImageChange}
    />
  );
}
